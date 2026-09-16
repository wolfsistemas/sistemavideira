-- 009_rls_por_igreja.sql
-- Liga o isolamento por igreja nas politicas de RLS das 15 tabelas.
-- ADITIVO nos dados: nao altera linhas. Reversivel com
--   supabase/rollback/009_rls_por_igreja_rollback.sql
-- Requer 007 (sou_super_admin) e 008 (minha_igreja/igreja_requisicao/igreja_default).

begin;

-- predicados:
--   auth.role()='authenticated' and (igreja_id = igreja_requisicao() or sou_super_admin())
--   insert: igreja_id = igreja_default() or sou_super_admin()

-- ===== arquivado =====
drop policy if exists p_sel_arquivado on public.arquivado;
create policy p_sel_arquivado on public.arquivado for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_arquivado on public.arquivado;
create policy p_ins_arquivado on public.arquivado for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_arquivado on public.arquivado;
create policy p_upd_arquivado on public.arquivado for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_arquivado on public.arquivado;
create policy p_del_arquivado on public.arquivado for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== celulas =====
drop policy if exists p_sel_celulas on public.celulas;
create policy p_sel_celulas on public.celulas for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_celulas on public.celulas;
create policy p_ins_celulas on public.celulas for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_celulas on public.celulas;
create policy p_upd_celulas on public.celulas for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_celulas on public.celulas;
create policy p_del_celulas on public.celulas for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== controle_apascentar =====
drop policy if exists p_sel_controle_apascentar on public.controle_apascentar;
create policy p_sel_controle_apascentar on public.controle_apascentar for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_controle_apascentar on public.controle_apascentar;
create policy p_ins_controle_apascentar on public.controle_apascentar for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_controle_apascentar on public.controle_apascentar;
create policy p_upd_controle_apascentar on public.controle_apascentar for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_controle_apascentar on public.controle_apascentar;
create policy p_del_controle_apascentar on public.controle_apascentar for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== logs =====
drop policy if exists p_sel_logs on public.logs;
create policy p_sel_logs on public.logs for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_logs on public.logs;
create policy p_ins_logs on public.logs for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_logs on public.logs;
create policy p_upd_logs on public.logs for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_logs on public.logs;
create policy p_del_logs on public.logs for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== palavras =====
drop policy if exists p_sel_palavras on public.palavras;
create policy p_sel_palavras on public.palavras for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_palavras on public.palavras;
create policy p_ins_palavras on public.palavras for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_palavras on public.palavras;
create policy p_upd_palavras on public.palavras for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_palavras on public.palavras;
create policy p_del_palavras on public.palavras for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== presencas =====
drop policy if exists p_sel_presencas on public.presencas;
create policy p_sel_presencas on public.presencas for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_presencas on public.presencas;
create policy p_ins_presencas on public.presencas for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_presencas on public.presencas;
create policy p_upd_presencas on public.presencas for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_presencas on public.presencas;
create policy p_del_presencas on public.presencas for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== relatorios =====
drop policy if exists p_sel_relatorios on public.relatorios;
create policy p_sel_relatorios on public.relatorios for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_relatorios on public.relatorios;
create policy p_ins_relatorios on public.relatorios for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_relatorios on public.relatorios;
create policy p_upd_relatorios on public.relatorios for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_relatorios on public.relatorios;
create policy p_del_relatorios on public.relatorios for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== sugestoes =====
drop policy if exists p_sel_sugestoes on public.sugestoes;
create policy p_sel_sugestoes on public.sugestoes for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_sugestoes on public.sugestoes;
create policy p_ins_sugestoes on public.sugestoes for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_sugestoes on public.sugestoes;
create policy p_upd_sugestoes on public.sugestoes for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_sugestoes on public.sugestoes;
create policy p_del_sugestoes on public.sugestoes for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== pessoas =====
drop policy if exists p_sel_pessoas on public.pessoas;
create policy p_sel_pessoas on public.pessoas for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_pessoas on public.pessoas;
create policy p_ins_pessoas on public.pessoas for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_pessoas on public.pessoas;
create policy p_upd_pessoas on public.pessoas for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_pessoas on public.pessoas;
create policy p_del_pessoas on public.pessoas for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== pessoas: convite (mantido) + gravacao do proprio cadastro =====
drop policy if exists p_sel_pessoas_convite on public.pessoas;
create policy p_sel_pessoas_convite on public.pessoas for select to public
  using (token_convite is not null);
drop policy if exists p_upd_pessoas_convite on public.pessoas;
create policy p_upd_pessoas_convite on public.pessoas for update to public
  using (token_convite is not null)
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

-- ===== eventos =====
drop policy if exists eventos_select_todos on public.eventos;
create policy eventos_select_todos on public.eventos for select to anon, authenticated
  using ((igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists eventos_insert_pastor_admin on public.eventos;
create policy eventos_insert_pastor_admin on public.eventos for insert to authenticated
  with check (is_pastor_admin() and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists eventos_update_pastor_admin on public.eventos;
create policy eventos_update_pastor_admin on public.eventos for update to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists eventos_delete_pastor_admin on public.eventos;
create policy eventos_delete_pastor_admin on public.eventos for delete to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== inscricoes_eventos =====
drop policy if exists inscricoes_select_pastor_admin on public.inscricoes_eventos;
create policy inscricoes_select_pastor_admin on public.inscricoes_eventos for select to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists inscricoes_insert_publico on public.inscricoes_eventos;
create policy inscricoes_insert_publico on public.inscricoes_eventos for insert to anon, authenticated
  with check ((igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists inscricoes_update_pastor_admin on public.inscricoes_eventos;
create policy inscricoes_update_pastor_admin on public.inscricoes_eventos for update to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists inscricoes_delete_pastor_admin on public.inscricoes_eventos;
create policy inscricoes_delete_pastor_admin on public.inscricoes_eventos for delete to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== push_config =====
drop policy if exists push_config_select on public.push_config;
create policy push_config_select on public.push_config for select to authenticated
  using ((igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists push_config_insert on public.push_config;
create policy push_config_insert on public.push_config for insert to authenticated
  with check (is_pastor_admin() and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists push_config_update on public.push_config;
create policy push_config_update on public.push_config for update to authenticated
  using (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (is_pastor_admin() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

-- ===== default dinamico de igreja_id (permite escrita multi-igreja) =====
alter table public.anotacoes alter column igreja_id set default public.igreja_default();
alter table public.arquivado alter column igreja_id set default public.igreja_default();
alter table public.celulas alter column igreja_id set default public.igreja_default();
alter table public.controle_apascentar alter column igreja_id set default public.igreja_default();
alter table public.eventos alter column igreja_id set default public.igreja_default();
alter table public.financeiro alter column igreja_id set default public.igreja_default();
alter table public.inscricoes_eventos alter column igreja_id set default public.igreja_default();
alter table public.logs alter column igreja_id set default public.igreja_default();
alter table public.palavras alter column igreja_id set default public.igreja_default();
alter table public.pessoas alter column igreja_id set default public.igreja_default();
alter table public.presencas alter column igreja_id set default public.igreja_default();
alter table public.push_config alter column igreja_id set default public.igreja_default();
alter table public.push_subscriptions alter column igreja_id set default public.igreja_default();
alter table public.relatorios alter column igreja_id set default public.igreja_default();
alter table public.sugestoes alter column igreja_id set default public.igreja_default();

commit;
