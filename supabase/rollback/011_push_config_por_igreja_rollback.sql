-- 011_push_config_por_igreja_rollback.sql
-- Reverte a migration 011 (volta a PK para (chave)).
-- ATENCAO: para restaurar a PK antiga e preciso manter apenas uma linha
-- por chave. Este script remove as linhas das igrejas que nao sao a padrao.
-- Execute SOMENTE se for realmente reverter e com backup.

begin;

drop trigger if exists push_config_seed_nova_igreja on public.igrejas;
drop function if exists public.push_config_seed_igreja();

delete from public.push_config
where igreja_id <> 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;

alter table public.push_config drop constraint if exists push_config_pkey;
alter table public.push_config add constraint push_config_pkey primary key (chave);

commit;
