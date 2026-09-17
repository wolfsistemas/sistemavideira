-- 024_superadmin_logs.sql
-- Separa as acoes do fornecedor (super admin) das logs das igrejas.
--
-- Antes: superadmin.html gravava em public.logs com igreja_id, entao os admins
-- da igreja viam as acoes do fornecedor na Auditoria.
-- Depois: as acoes do fornecedor ficam em public.superadmin_logs, visiveis
-- somente para o super admin (RLS com sou_super_admin()).
--
-- Tambem move o historico ja existente de logs cujo usuario e super admin
-- para a nova tabela (remove da visao da igreja, preservando a auditoria).

create table if not exists public.superadmin_logs (
  id         uuid primary key default gen_random_uuid(),
  datahora   text,
  usuario    text,
  nomelider  text,
  acao       text,
  igreja_id  uuid references public.igrejas(id) on delete set null
);

create index if not exists idx_superadmin_logs_datahora on public.superadmin_logs (datahora desc);
create index if not exists idx_superadmin_logs_igreja   on public.superadmin_logs (igreja_id);

alter table public.superadmin_logs enable row level security;

drop policy if exists sa_logs_all on public.superadmin_logs;
create policy sa_logs_all on public.superadmin_logs
  for all to authenticated
  using (public.sou_super_admin())
  with check (public.sou_super_admin());

grant select, insert, update, delete on public.superadmin_logs to authenticated;

-- Move o historico de acoes do fornecedor para a nova tabela (idempotente:
-- depois da primeira execucao nao ha mais linhas de super admin em logs).
with movidos as (
  delete from public.logs l
   where lower(coalesce(l.usuario, '')) in (
     select lower(p.email) from public.pessoas p where p.super_admin is true
   )
  returning l.datahora, l.usuario, l.nomelider, l.acao, l.igreja_id
)
insert into public.superadmin_logs (datahora, usuario, nomelider, acao, igreja_id)
select datahora, usuario, nomelider, acao, igreja_id from movidos;
