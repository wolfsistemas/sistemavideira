-- 018_push_registrar.sql
-- Corrige o registro de push (bug 403) de forma ADITIVA: apenas cria uma funcao.
--
-- Problema: push_subscriptions.endpoint e UNIQUE e a RLS so permite alterar a
-- propria linha (pessoa_id = seu e-mail). O upsert({ onConflict: 'endpoint' })
-- vira INSERT ... ON CONFLICT (endpoint) DO UPDATE; quando o endpoint ja existe
-- para OUTRA pessoa (navegador/aparelho compartilhado), o UPDATE cai numa linha
-- de outro dono e a RLS barra -> 403, silencioso no cliente.
--
-- Solucao: RPC SECURITY DEFINER que faz o upsert pelo endpoint e assume a posse
-- da assinatura para o usuario logado. O endpoint pertence ao NAVEGADOR; quem
-- esta logado nele e quem deve receber as notificacoes.
--
-- FALLBACK (reverter): ver supabase/rollback/018_push_registrar_rollback.sql

begin;

create or replace function public.registrar_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email  text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_pessoa record;
  v_id     uuid;
begin
  if auth.role() <> 'authenticated' or v_email = '' then
    raise exception 'nao autenticado';
  end if;

  if btrim(coalesce(p_endpoint, '')) = '' then
    raise exception 'endpoint obrigatorio';
  end if;
  if char_length(p_endpoint) > 2048 then
    raise exception 'endpoint muito longo';
  end if;
  if btrim(coalesce(p_p256dh, '')) = '' or btrim(coalesce(p_auth, '')) = '' then
    raise exception 'chaves de assinatura obrigatorias';
  end if;

  select p.id, p.igreja_id
    into v_pessoa
    from public.pessoas p
   where lower(p.email) = v_email
   order by p.id
   limit 1;

  if v_pessoa.id is null then
    raise exception 'pessoa nao encontrada';
  end if;

  insert into public.push_subscriptions
    (pessoa_id, endpoint, p256dh, auth, user_agent, igreja_id, updated_at)
  values
    (v_pessoa.id, btrim(p_endpoint), p_p256dh, p_auth, p_user_agent, v_pessoa.igreja_id, now())
  on conflict (endpoint) do update
    set pessoa_id  = excluded.pessoa_id,
        p256dh      = excluded.p256dh,
        auth        = excluded.auth,
        user_agent  = excluded.user_agent,
        igreja_id   = excluded.igreja_id,
        updated_at  = now()
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'pessoa_id', v_pessoa.id,
    'igreja_id', v_pessoa.igreja_id
  );
end;
$$;

-- Por padrao o Postgres concede EXECUTE a PUBLIC; restringe a escrita a logados.
revoke execute on function public.registrar_push(text, text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text, text) to authenticated;

commit;
