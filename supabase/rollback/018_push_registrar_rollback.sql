-- 018_push_registrar_rollback.sql
-- Reverte a migration 018 (remove a RPC registrar_push). ADITIVO so cria funcao,
-- entao o rollback nao altera dados.

begin;

revoke execute on function public.registrar_push(text, text, text, text) from authenticated;
drop function if exists public.registrar_push(text, text, text, text);

commit;
