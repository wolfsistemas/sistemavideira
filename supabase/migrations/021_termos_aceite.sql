-- 021_termos_aceite.sql
-- Registro do aceite dos Termos de Uso / Politica de Privacidade.
-- ADITIVO nos dados (apenas novas colunas em pessoas + nova funcao).
-- Reversivel com supabase/rollback/021_termos_aceite_rollback.sql

begin;

alter table public.pessoas
  add column if not exists termos_aceite_em timestamptz,
  add column if not exists termos_aceite_versao text;

-- Grava o aceite do usuario autenticado (identificado pelo e-mail do JWT).
-- Idempotente: pode ser chamada mais de uma vez, sempre atualizando a versao.
create or replace function public.registrar_aceite_termos(p_versao text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_id    uuid;
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'erro', 'nao_autenticado');
  end if;

  update public.pessoas
     set termos_aceite_em = now(),
         termos_aceite_versao = p_versao
   where lower(email) = lower(v_email)
   returning id into v_id;

  return jsonb_build_object(
    'ok', v_id is not null,
    'pessoa_id', v_id,
    'versao', p_versao,
    'aceite_em', now()
  );
end $$;

grant execute on function public.registrar_aceite_termos(text) to authenticated;
revoke execute on function public.registrar_aceite_termos(text) from public, anon;

commit;
