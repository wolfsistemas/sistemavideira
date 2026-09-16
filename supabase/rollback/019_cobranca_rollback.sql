-- rollback de 019_cobranca.sql
-- Restaura definir_igreja_plano ao comportamento anterior (sem mesclar) e remove
-- os objetos criados nesta migration.

drop function if exists public.igreja_cobrancas(uuid);
drop function if exists public.definir_config_financeiro(jsonb);
drop function if exists public.config_financeiro();
drop trigger if exists cobrancas_touch on public.cobrancas;
drop function if exists public.tg_cobrancas_touch();
drop policy if exists config_global_super on public.config_global;
drop policy if exists cobrancas_select on public.cobrancas;
drop table if exists public.config_global;
drop table if exists public.cobrancas;

-- volta a versão que sobrescreve o plano (compõe o objeto completo)
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
     set config = jsonb_set(coalesce(config, '{}'::jsonb), '{plano}', v_plano, true)
   where id = v_igreja;

  return v_plano;
end $$;
