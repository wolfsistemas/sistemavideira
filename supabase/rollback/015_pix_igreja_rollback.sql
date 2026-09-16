-- rollback/015_pix_igreja_rollback.sql
-- Reverte a migration 015: remove as funcoes de PIX da igreja.
-- Obs.: os valores ja gravados em igrejas.config->'pix' NAO sao removidos.
begin;
drop function if exists public.definir_pix_igreja(text, text, text, uuid);
drop function if exists public.pix_igreja();
commit;
