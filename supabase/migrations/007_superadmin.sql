-- 007_superadmin.sql
-- Habilita o painel do super admin do fornecedor.
-- ADITIVO e reversivel: nao altera dados existentes. Cria apenas uma funcao
-- auxiliar e politicas de RLS SOMENTE na tabela igrejas (as demais tabelas
-- continuam com as politicas permissivas atuais, intactas).
--
-- FALLBACK (reverter manualmente):
--   drop policy if exists igrejas_select_super on public.igrejas;
--   drop policy if exists igrejas_insert_super on public.igrejas;
--   drop policy if exists igrejas_update_super on public.igrejas;
--   drop function if exists public.sou_super_admin();

begin;

-- Retorna true quando o e-mail do JWT pertence a uma pessoa marcada como super_admin.
create or replace function public.sou_super_admin()
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $$
  select coalesce(bool_or(p.super_admin), false)
  from public.pessoas p
  where lower(p.email) = lower(auth.jwt() ->> 'email');
$$;

alter table public.igrejas enable row level security;

drop policy if exists igrejas_select_super on public.igrejas;
create policy igrejas_select_super on public.igrejas
  for select to authenticated using (public.sou_super_admin());

drop policy if exists igrejas_insert_super on public.igrejas;
create policy igrejas_insert_super on public.igrejas
  for insert to authenticated with check (public.sou_super_admin());

drop policy if exists igrejas_update_super on public.igrejas;
create policy igrejas_update_super on public.igrejas
  for update to authenticated
  using (public.sou_super_admin())
  with check (public.sou_super_admin());

commit;
