-- 022_plano_acesso_ate.sql
-- Edicao manual do vencimento ("acesso ate") pelo super admin e ajuste da
-- regra de liberacao para que o vencimento realmente expire.
--
-- Correcoes:
--  * definir_igreja_plano passa a aceitar 'acesso_ate' (YYYY-MM-DD). Em branco
--    limpa a data. Assim o fornecedor consegue prorrogar/vencer manualmente.
--  * igreja_liberada passa a considerar acesso_ate vencido como BLOQUEIO
--    (antes o plano anual nunca expirava, pois o status continuava 'ativo').
--    - isento sempre libera (regra de ouro, nao muda);
--    - acesso_ate valido: futuro libera, vencido bloqueia;
--    - sem acesso_ate: vale a situacao (ativo/trial/vazio libera,
--      inadimplente/cancelado bloqueia).

-- ---------------------------------------------------------------------------
-- definir_igreja_plano (mescla, preservando campos gravados pelo Mercado Pago)
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
  v_acesso   text := btrim(coalesce(p_plano ->> 'acesso_ate', ''));
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

  if v_acesso <> '' then
    if v_acesso !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'data de acesso invalida';
    end if;
    begin
      perform v_acesso::date;
    exception when others then
      raise exception 'data de acesso invalida';
    end;
  end if;

  v_plano := jsonb_build_object(
    'plano',          nullif(v_nome, ''),
    'status',         nullif(v_status, ''),
    'valor',          case when v_valor = '' then null else (v_valor::numeric) end,
    'dia_vencimento', case when v_dia = '' then null else v_dia::int end,
    'inicio',         nullif(v_inicio, ''),
    'trial_fim',      nullif(v_trial, ''),
    'acesso_ate',     nullif(v_acesso, ''),
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

-- ---------------------------------------------------------------------------
-- Regra central de liberacao (acesso_ate vencido bloqueia; isento sempre libera)
-- ---------------------------------------------------------------------------
create or replace function public.igreja_liberada(p_igreja_id uuid)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select case
    when p_igreja_id is null then true
    when not exists (select 1 from public.igrejas where id = p_igreja_id and ativa) then false
    else coalesce(
      (
        select
          case
            when lower(coalesce(i.config -> 'plano' ->> 'status', '')) = 'isento' then true
            when (i.config -> 'plano' ->> 'acesso_ate') ~ '^\d{4}-\d{2}-\d{2}'
              then left(i.config -> 'plano' ->> 'acesso_ate', 10)::date >= current_date
            when lower(coalesce(i.config -> 'plano' ->> 'status', '')) in ('inadimplente', 'cancelado')
              then false
            else true
          end
        from public.igrejas i
        where i.id = p_igreja_id
      ),
      true
    )
  end;
$$;
