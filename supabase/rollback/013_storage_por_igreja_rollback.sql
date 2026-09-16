-- rollback/013_storage_por_igreja_rollback.sql
-- Reverte a migration 013: volta as policies GLOBAIS de storage.objects
-- (estado anterior, sem isolamento por igreja) e remove o helper.
-- Nao mexe em objetos/arquivos.
--
-- ATENCAO: reabre o vazamento cross-igreja (listar/apagar arquivos de outra
-- igreja). Usar apenas em caso de problema.

begin;

-- Bucket 'comprovantes' (estado original da migration 005)
drop policy if exists comprovantes_insert on storage.objects;
create policy comprovantes_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'comprovantes');

drop policy if exists comprovantes_select on storage.objects;
create policy comprovantes_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'comprovantes');

drop policy if exists comprovantes_delete on storage.objects;
create policy comprovantes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprovantes');

-- Bucket 'eventos' (estado original, policies criadas fora de migration)
drop policy if exists eventos_storage_insert_pastor_admin on storage.objects;
create policy eventos_storage_insert_pastor_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'eventos' and public.is_pastor_admin());

drop policy if exists eventos_storage_select_publico on storage.objects;
create policy eventos_storage_select_publico on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'eventos');

drop policy if exists eventos_storage_delete_pastor_admin on storage.objects;
create policy eventos_storage_delete_pastor_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'eventos' and public.is_pastor_admin());

drop function if exists public.igreja_valida(text);

commit;
