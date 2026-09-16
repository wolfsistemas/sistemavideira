-- rollback/016_igreja_info_rollback.sql
-- Reverte a migration 016_igreja_info.sql (apenas remove as funcoes).
-- Os dados ja gravados em igrejas.config->'info' NAO sao apagados (aditivo).

begin;

revoke execute on function public.definir_igreja_info(jsonb, uuid) from authenticated;
revoke execute on function public.igreja_info(uuid) from authenticated;

drop function if exists public.definir_igreja_info(jsonb, uuid);
drop function if exists public.igreja_info(uuid);

commit;
