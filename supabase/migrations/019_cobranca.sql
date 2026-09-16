-- 019_cobranca.sql
-- Cobrança por igreja (Mercado Pago). Alterações ADITIVAS.
--
--  * cobrancas        -> histórico de faturas/pagamentos por igreja
--  * config_global    -> valores padronizados (mensal/anual/trial) definidos pelo fornecedor
--  * RPCs             -> config_financeiro / definir_config_financeiro / igreja_cobrancas
--  * definir_igreja_plano passa a MESCLAR com o plano existente (não apaga campos do Mercado Pago)

-- ---------------------------------------------------------------------------
-- Histórico de cobranças
-- ---------------------------------------------------------------------------
create table if not exists public.cobrancas (
  id                uuid primary key default gen_random_uuid(),
  igreja_id         uuid not null references public.igrejas(id) on delete cascade,
  tipo              text not null default 'mensal',   -- mensal | anual
  metodo            text,                             -- credito | pix
  status            text not null default 'pendente', -- pendente|em_processamento|aprovado|recusado|cancelado|reembolsado
  valor             numeric(12,2) not null default 0,
  descricao         text,
  data_vencimento   date,
  data_pagamento    timestamptz,
  mp_payment_id     text unique,
  mp_preapproval_id text,
  referencia        text,
  payload           jsonb,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

do $$ begin
  alter table public.cobrancas add constraint cobrancas_status_chk
    check (status in ('pendente','em_processamento','aprovado','recusado','cancelado','reembolsado'));
exception when duplicate_object then null; end $$;

create index if not exists cobrancas_igreja_idx on public.cobrancas (igreja_id, criado_em desc);
create index if not exists cobrancas_preapproval_idx on public.cobrancas (mp_preapproval_id);

alter table public.cobrancas enable row level security;

drop policy if exists cobrancas_select on public.cobrancas;
create policy cobrancas_select on public.cobrancas
  for select to authenticated
  using (
    public.sou_super_admin()
    or (igreja_id = public.minha_igreja() and public.is_admin_or_pastor())
  );

-- ---------------------------------------------------------------------------
-- Valores padronizados (globais). Fora dos cards de igreja.
-- ---------------------------------------------------------------------------
create table if not exists public.config_global (
  chave         text primary key,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

insert into public.config_global (chave, valor)
values ('financeiro', '{"valor_mensal": null, "valor_anual": null, "trial_dias": 7}'::jsonb)
on conflict (chave) do nothing;

alter table public.config_global enable row level security;

drop policy if exists config_global_super on public.config_global;
create policy config_global_super on public.config_global
  for all to authenticated
  using (public.sou_super_admin())
  with check (public.sou_super_admin());

-- ---------------------------------------------------------------------------
-- touch atualizado_em
-- ---------------------------------------------------------------------------
create or replace function public.tg_cobrancas_touch()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists cobrancas_touch on public.cobrancas;
create trigger cobrancas_touch before update on public.cobrancas
  for each row execute function public.tg_cobrancas_touch();

-- ---------------------------------------------------------------------------
-- RPC: ler valores padronizados (fornecedor)
-- ---------------------------------------------------------------------------
create or replace function public.config_financeiro()
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v jsonb;
begin
  if not public.sou_super_admin() then
    raise exception 'apenas o fornecedor pode ver a configuracao';
  end if;
  select valor into v from public.config_global where chave = 'financeiro';
  return coalesce(v, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: definir valores padronizados (fornecedor)
-- ---------------------------------------------------------------------------
create or replace function public.definir_config_financeiro(p_config jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v jsonb := '{}'::jsonb;
  v_mes text := btrim(coalesce(p_config ->> 'valor_mensal', ''));
  v_ano text := btrim(coalesce(p_config ->> 'valor_anual', ''));
  v_tri text := btrim(coalesce(p_config ->> 'trial_dias', ''));
begin
  if not public.sou_super_admin() then
    raise exception 'apenas o fornecedor pode alterar a configuracao';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'dados invalidos';
  end if;
  if v_mes <> '' and v_mes !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception 'valor mensal invalido';
  end if;
  if v_ano <> '' and v_ano !~ '^[0-9]+([.][0-9]{1,2})?$' then
    raise exception 'valor anual invalido';
  end if;
  if v_tri <> '' and v_tri !~ '^[0-9]{1,3}$' then
    raise exception 'dias de trial invalidos';
  end if;

  v := jsonb_build_object(
    'valor_mensal', case when v_mes = '' then null else v_mes::numeric end,
    'valor_anual',  case when v_ano = '' then null else v_ano::numeric end,
    'trial_dias',   case when v_tri = '' then null else v_tri::int end
  );

  insert into public.config_global (chave, valor, atualizado_em)
  values ('financeiro', v, now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

  return v;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: listar cobranças de uma igreja
-- ---------------------------------------------------------------------------
create or replace function public.igreja_cobrancas(p_igreja_id uuid default null)
returns setof public.cobrancas
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_igreja uuid;
begin
  if public.sou_super_admin() and p_igreja_id is not null then
    v_igreja := p_igreja_id;
  else
    v_igreja := public.minha_igreja();
    if not (public.sou_super_admin() or public.is_admin_or_pastor()) then
      raise exception 'sem permissao';
    end if;
  end if;

  if v_igreja is null then
    return;
  end if;

  return query
    select *
      from public.cobrancas c
     where c.igreja_id = v_igreja
     order by c.criado_em desc
     limit 100;
end $$;

-- ---------------------------------------------------------------------------
-- definir_igreja_plano: MESCLA com o plano existente para preservar os campos
-- gravados pelo Mercado Pago (preapproval_id, acesso_ate, proximo_vencimento...).
-- ---------------------------------------------------------------------------
create or replace function public.definir_igreja_plano(p_plano jsonb, p_igreja_id uuid default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_igreja   uuid;
  v_plano    jsonb := '{}'::jsonb;
  v_nome     text := btrim(coalesce(p_plano ->> 'plano', ''));
  v_status   text := lower(btrim(coalesce(p_plano ->> 'status', '')));
  v_valor    text := btrim(coalesce(p_plano ->> 'valor', ''));
  v_dia      text := btrim(coalesce(p_plano ->> 'dia_vencimento', ''));
  v_inicio   text := btrim(coalesce(p_plano ->> 'inicio', ''));
  v_trial    text := btrim(coalesce(p_plano ->> 'trial_fim', ''));
  v_obs      text := btrim(coalesce(p_plano ->> 'observacao', ''));
begin
  if not public.sou_super_admin() then
    raise exception 'apenas o fornecedor pode alterar o plano';
  end if;

  if p_igreja_id is not null then
    v_igreja := p_igreja_id;
  else
    v_igreja := public.igreja_default();
  end if;

  if v_igreja is null then
    raise exception 'igreja nao identificada';
  end if;

  if p_plano is null or jsonb_typeof(p_plano) <> 'object' then
    raise exception 'dados invalidos';
  end if;

  if char_length(v_nome) > 60 then raise exception 'nome do plano muito longo'; end if;
  if v_status <> '' and v_status not in ('trial','ativo','isento','inadimplente','cancelado') then
    raise exception 'situacao invalida';
  end if;
  if char_length(v_obs) > 300 then raise exception 'observacao muito longa'; end if;

  if v_valor <> '' then
    if v_valor !~ '^[0-9]+([.][0-9]{1,2})?$' then raise exception 'valor invalido'; end if;
  end if;

  if v_dia <> '' then
    if v_dia !~ '^[0-9]{1,2}$' or (v_dia::int < 1 or v_dia::int > 31) then
      raise exception 'dia de vencimento invalido';
    end if;
  end if;

  if v_inicio <> '' and v_inicio !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'data de inicio invalida';
  end if;
  if v_trial <> '' and v_trial !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'data de trial invalida';
  end if;

  v_plano := jsonb_build_object(
    'plano',          nullif(v_nome, ''),
    'status',         nullif(v_status, ''),
    'valor',          case when v_valor = '' then null else (v_valor::numeric) end,
    'dia_vencimento', case when v_dia = '' then null else v_dia::int end,
    'inicio',         nullif(v_inicio, ''),
    'trial_fim',      nullif(v_trial, ''),
    'observacao',     nullif(v_obs, '')
  );

  update public.igrejas
     set config = jsonb_set(
           coalesce(config, '{}'::jsonb),
           '{plano}',
           coalesce(config -> 'plano', '{}'::jsonb) || v_plano,
           true
         )
   where id = v_igreja;

  select config -> 'plano' into v_plano from public.igrejas where id = v_igreja;
  return coalesce(v_plano, '{}'::jsonb);
end $$;
