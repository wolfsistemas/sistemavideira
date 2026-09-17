-- 023_trial_vencido_upsell.sql
-- Trial com data vencida passa a bloquear, com tela amigavel de venda
-- ("Gostou do sistema?") e botoes de pagamento para QUALQUER usuario da igreja.
--
--  * igreja_liberada: passa a considerar trial_fim (vencido bloqueia).
--    Ordem: isento -> acesso_ate (decide pela data) -> inadimplente/cancelado
--    -> trial_fim (decide pela data) -> liberado.
--  * acesso_igreja: devolve 'motivo' (trial_vencido|acesso_vencido|inadimplente|
--    cancelado), 'pode_pagar' (todos nos casos amigaveis; admin nos demais) e os
--    valores mensal/anual para exibir na tela.
--  * igrejas: trigger que, ao criar igreja sem plano definido, grava
--    status='trial', inicio=hoje e trial_fim=hoje+dias_de_trial (config_global).
--
-- Nao altera nenhum dado existente; apenas novas igrejas recebem o trial padrao
-- e a regra de leitura passa a expirar trial/acesso pelas datas ja gravadas.

-- ---------------------------------------------------------------------------
-- Regra central (trial vencido bloqueia)
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
            when (i.config -> 'plano' ->> 'trial_fim') ~ '^\d{4}-\d{2}-\d{2}'
              then left(i.config -> 'plano' ->> 'trial_fim', 10)::date >= current_date
            else true
          end
        from public.igrejas i
        where i.id = p_igreja_id
      ),
      true
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Contexto de acesso (motivo + valores + pode_pagar)
-- ---------------------------------------------------------------------------
create or replace function public.acesso_igreja()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_email    text := auth.jwt() ->> 'email';
  v_pessoa   record;
  v_igreja   uuid;
  v_status   text := '';
  v_acesso   text := '';
  v_trial    text := '';
  v_plano    jsonb := '{}'::jsonb;
  v_cfg      jsonb := '{}'::jsonb;
  v_papel    text := 'membro';
  v_liberado boolean := true;
  v_msg      text := '';
  v_motivo   text := '';
  v_pagar    boolean := false;
  v_mensal   numeric;
  v_anual    numeric;
begin
  if public.sou_super_admin() then
    return jsonb_build_object(
      'liberado', true, 'papel', 'fornecedor', 'status', 'isento', 'motivo', '',
      'mensagem', '', 'pode_pagar', false, 'valor_mensal', null, 'valor_anual', null
    );
  end if;

  select p.categoria, p.igreja_id
    into v_pessoa
    from public.pessoas p
   where lower(p.email) = lower(coalesce(v_email, ''))
   limit 1;

  if v_pessoa.igreja_id is null then
    -- sem igreja vinculada: nao bloqueia (evita quebrar contas legadas)
    return jsonb_build_object(
      'liberado', true, 'papel', 'desconhecido', 'status', '', 'motivo', '',
      'mensagem', '', 'pode_pagar', false, 'valor_mensal', null, 'valor_anual', null
    );
  end if;

  v_igreja := v_pessoa.igreja_id;
  select coalesce(config -> 'plano', '{}'::jsonb) into v_plano
    from public.igrejas where id = v_igreja;

  v_status := lower(coalesce(v_plano ->> 'status', ''));
  v_acesso := coalesce(v_plano ->> 'acesso_ate', '');
  v_trial  := coalesce(v_plano ->> 'trial_fim', '');

  v_liberado := public.igreja_liberada(v_igreja);

  v_papel := case public.fn_normaliza_categoria(v_pessoa.categoria)
    when 'administrador' then 'admin'
    when 'pastor de governo' then 'pastor'
    when 'pastor de rede' then 'pastor'
    when 'pastor' then 'pastor'
    when 'discipulador' then 'discipulador'
    when 'lider' then 'lider'
    else 'membro'
  end;

  if not v_liberado then
    if v_status in ('inadimplente', 'cancelado') then
      v_motivo := v_status;
    elsif v_acesso ~ '^\d{4}-\d{2}-\d{2}' then
      v_motivo := 'acesso_vencido';
    elsif v_trial ~ '^\d{4}-\d{2}-\d{2}' then
      v_motivo := 'trial_vencido';
    else
      v_motivo := coalesce(nullif(v_status, ''), 'bloqueado');
    end if;

    if v_motivo in ('trial_vencido', 'acesso_vencido') then
      v_msg := 'Gostou do sistema? Regularize para continuar usando.';
      v_pagar := true; -- qualquer usuario da igreja pode pagar (inclusive ofertar)
    elsif v_papel in ('lider', 'discipulador', 'membro') then
      v_msg := 'Acesso negado, contacte seu pastor de Rede';
    else
      v_msg := 'Renove a Assinatura';
      v_pagar := true; -- admin regulariza
    end if;
  end if;

  -- valores para exibir na tela (plano da igreja com fallback no config global)
  select valor into v_cfg from public.config_global where chave = 'financeiro';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_mensal := coalesce((v_plano ->> 'valor')::numeric, (v_cfg ->> 'valor_mensal')::numeric);
  v_anual  := coalesce((v_plano ->> 'valor_anual')::numeric, (v_cfg ->> 'valor_anual')::numeric);

  return jsonb_build_object(
    'liberado', v_liberado,
    'papel', v_papel,
    'status', v_status,
    'motivo', v_motivo,
    'mensagem', v_msg,
    'pode_pagar', (not v_liberado and v_pagar),
    'valor_mensal', v_mensal,
    'valor_anual', v_anual
  );
end $$;

-- ---------------------------------------------------------------------------
-- Trial padrao ao criar igreja (somente quando nao ha plano definido)
-- ---------------------------------------------------------------------------
create or replace function public.tg_igreja_trial_default()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_dias  int := 7;
  v_plano jsonb;
begin
  new.config := coalesce(new.config, '{}'::jsonb);
  v_plano := coalesce(new.config -> 'plano', '{}'::jsonb);

  if v_plano = '{}'::jsonb then
    select coalesce((valor ->> 'trial_dias')::int, 7)
      into v_dias
      from public.config_global
     where chave = 'financeiro';
    if v_dias is null or v_dias < 0 then v_dias := 7; end if;

    new.config := jsonb_set(
      new.config,
      '{plano}',
      jsonb_build_object(
        'status',    'trial',
        'inicio',    to_char(current_date, 'YYYY-MM-DD'),
        'trial_fim', to_char(current_date + v_dias, 'YYYY-MM-DD')
      ),
      true
    );
  end if;

  return new;
end $$;

drop trigger if exists igreja_trial_default on public.igrejas;
create trigger igreja_trial_default
  before insert on public.igrejas
  for each row execute function public.tg_igreja_trial_default();
