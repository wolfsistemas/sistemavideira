-- rollback de 023_trial_vencido_upsell.sql
-- Restaura igreja_liberada (022, sem trial_fim) e acesso_igreja (020, sem motivo),
-- e remove o trigger/function de trial padrao.

drop trigger if exists igreja_trial_default on public.igrejas;
drop function if exists public.tg_igreja_trial_default();

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

create or replace function public.acesso_igreja()
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_email    text := auth.jwt() ->> 'email';
  v_pessoa   record;
  v_igreja   uuid;
  v_status   text := '';
  v_papel    text := 'membro';
  v_liberado boolean := true;
  v_msg      text := '';
begin
  if public.sou_super_admin() then
    return jsonb_build_object(
      'liberado', true, 'papel', 'fornecedor', 'status', 'isento',
      'mensagem', '', 'pode_pagar', false
    );
  end if;

  select p.categoria, p.igreja_id
    into v_pessoa
    from public.pessoas p
   where lower(p.email) = lower(coalesce(v_email, ''))
   limit 1;

  if v_pessoa.igreja_id is null then
    return jsonb_build_object(
      'liberado', true, 'papel', 'desconhecido', 'status', '',
      'mensagem', '', 'pode_pagar', false
    );
  end if;

  v_igreja := v_pessoa.igreja_id;
  select lower(coalesce(config -> 'plano' ->> 'status', ''))
    into v_status
    from public.igrejas where id = v_igreja;

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
    if v_papel in ('lider', 'discipulador', 'membro') then
      v_msg := 'Acesso negado, contacte seu pastor de Rede';
    else
      v_msg := 'Renove a Assinatura';
    end if;
  end if;

  return jsonb_build_object(
    'liberado', v_liberado,
    'papel', v_papel,
    'status', v_status,
    'mensagem', v_msg,
    'pode_pagar', (not v_liberado and v_papel = 'admin')
  );
end $$;
