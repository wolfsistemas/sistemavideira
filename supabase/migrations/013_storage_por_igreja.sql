-- 013_storage_por_igreja.sql
-- Isola os buckets de Storage ('comprovantes' e 'eventos') por igreja.
-- ADITIVO e reversivel: apenas troca policies (nao remove objetos nem dados).
-- Os buckets continuam PUBLICOS (URLs publicas antigas continuam validas);
-- o que muda e o LISTAR/APAGAR via API (RLS em storage.objects), que passa a
-- ser restrito a igreja dona do arquivo.
--
-- Convencao de caminho (a partir desta versao):
--   comprovantes: <igreja_id>/inscricoes/<arquivo>
--   eventos:      <igreja_id>/eventos/<arquivo>
-- Arquivos antigos (sem pasta de igreja) seguem acessiveis pela URL publica,
-- mas deixam de aparecer em listagens via API.
--
-- FALLBACK: ver rollback/013_storage_por_igreja_rollback.sql

begin;

-- Helper: valida se o texto e o id de uma igreja ativa (security definer para
-- poder consultar 'igrejas' mesmo no contexto anon, que nao tem SELECT nela).
create or replace function public.igreja_valida(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.igrejas
    where id::text = p and ativa
  );
$$;

grant execute on function public.igreja_valida(text) to anon, authenticated;

-- =========================================================
-- Bucket 'comprovantes'
-- =========================================================

-- INSERT: publico (link de inscricao). So aceita arquivo dentro de uma pasta
-- que seja o id de uma igreja ativa.
drop policy if exists comprovantes_insert on storage.objects;
create policy comprovantes_insert on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'comprovantes'
    and public.igreja_valida((storage.foldername(name))[1])
  );

-- SELECT (listar): apenas autenticado da propria igreja (ou super admin).
drop policy if exists comprovantes_select on storage.objects;
create policy comprovantes_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and (
      public.sou_super_admin()
      or (storage.foldername(name))[1] = public.igreja_requisicao()::text
    )
  );

-- DELETE: admin/pastor da propria igreja (ou super admin).
drop policy if exists comprovantes_delete on storage.objects;
create policy comprovantes_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprovantes'
    and (
      public.sou_super_admin()
      or (
        (storage.foldername(name))[1] = public.igreja_requisicao()::text
        and public.is_admin_or_pastor()
      )
    )
  );

-- =========================================================
-- Bucket 'eventos'
-- =========================================================

-- INSERT: admin/pastor, apenas na pasta da propria igreja (ou super admin).
drop policy if exists eventos_storage_insert_pastor_admin on storage.objects;
create policy eventos_storage_insert_pastor_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'eventos'
    and (
      public.sou_super_admin()
      or (
        (storage.foldername(name))[1] = public.igreja_requisicao()::text
        and public.is_pastor_admin()
      )
    )
  );

-- SELECT (listar): autenticado da propria igreja (ou super admin).
-- Leitura publica de imagens continua via URL publica do bucket.
drop policy if exists eventos_storage_select_publico on storage.objects;
create policy eventos_storage_select_publico on storage.objects
  for select to authenticated
  using (
    bucket_id = 'eventos'
    and (
      public.sou_super_admin()
      or (storage.foldername(name))[1] = public.igreja_requisicao()::text
    )
  );

-- DELETE: admin/pastor da propria igreja (ou super admin).
drop policy if exists eventos_storage_delete_pastor_admin on storage.objects;
create policy eventos_storage_delete_pastor_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'eventos'
    and (
      public.sou_super_admin()
      or (
        (storage.foldername(name))[1] = public.igreja_requisicao()::text
        and public.is_pastor_admin()
      )
    )
  );

commit;
