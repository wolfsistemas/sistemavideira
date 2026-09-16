-- 010_convite_rpc_rollback.sql
-- Reverte o 010: recria as politicas de convite e remove as RPCs.
begin;

create policy p_sel_pessoas_convite on public.pessoas for select to public
  using (token_convite is not null);
create policy p_upd_pessoas_convite on public.pessoas for update to public
  using (token_convite is not null)
  with check (lower(email) = lower(auth.jwt() ->> 'email'));

drop function if exists public.concluir_cadastro_convite(text, text, text, uuid);
drop function if exists public.buscar_convite(text);

commit;
