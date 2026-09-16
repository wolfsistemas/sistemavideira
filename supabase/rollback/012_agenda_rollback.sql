-- 012_agenda_rollback.sql
-- Reverte a migration 012 (remove a tabela de agenda manual).
-- ATENCAO: isto apaga os dados de agenda manual cadastrados.

begin;

drop policy if exists p_sel_agenda on public.agenda;
drop policy if exists p_ins_agenda on public.agenda;
drop policy if exists p_upd_agenda on public.agenda;
drop policy if exists p_del_agenda on public.agenda;
drop table if exists public.agenda;

commit;
