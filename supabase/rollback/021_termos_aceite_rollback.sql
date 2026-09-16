-- rollback de 021_termos_aceite.sql
-- Remove a funcao de registro do aceite e as colunas criadas.
-- ATENCAO: o drop das colunas elimina os aceites ja registrados.

drop function if exists public.registrar_aceite_termos(text);

alter table public.pessoas
  drop column if exists termos_aceite_versao,
  drop column if exists termos_aceite_em;
