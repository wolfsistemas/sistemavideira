-- rollback/014_nome_igreja_rollback.sql
-- Reverte a migration 014: remove a funcao de nome da igreja.
begin;
drop function if exists public.nome_igreja_atual();
commit;
