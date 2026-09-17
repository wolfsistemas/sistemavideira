-- rollback de 024_superadmin_logs.sql
-- Devolve as acoes do fornecedor para public.logs e remove a tabela nova.

with movidos as (
  delete from public.superadmin_logs
  returning datahora, usuario, nomelider, acao, igreja_id
)
insert into public.logs (datahora, usuario, nomelider, acao, igreja_id)
select datahora, usuario, nomelider, acao, coalesce(igreja_id, public.igreja_default())
  from movidos;

drop table if exists public.superadmin_logs;
