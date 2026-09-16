-- 012_agenda.sql
-- Agenda manual por igreja. ADITIVO: apenas cria a tabela 'agenda' e suas policies.
-- Usada pelas igrejas que nao tem Google Agenda (a Jatai continua com o GAS).
--
-- FALLBACK: ver supabase/rollback/012_agenda_rollback.sql
-- Requer 008 (minha_igreja/igreja_requisicao/igreja_default) e 007 (sou_super_admin).

begin;

create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null default public.igreja_default(),
  data date not null,
  titulo text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'agenda_igreja_id_fkey') then
    alter table public.agenda add constraint agenda_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_agenda_igreja_id on public.agenda(igreja_id);
create index if not exists idx_agenda_data on public.agenda(data);

alter table public.agenda enable row level security;

drop policy if exists p_sel_agenda on public.agenda;
create policy p_sel_agenda on public.agenda for select to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_ins_agenda on public.agenda;
create policy p_ins_agenda on public.agenda for insert to public
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_default() or public.sou_super_admin()));
drop policy if exists p_upd_agenda on public.agenda;
create policy p_upd_agenda on public.agenda for update to public
  using (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()))
  with check (auth.role() = 'authenticated'::text and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));
drop policy if exists p_del_agenda on public.agenda;
create policy p_del_agenda on public.agenda for delete to public
  using (auth.role() = 'authenticated'::text and is_admin_or_pastor() and (igreja_id = public.igreja_requisicao() or public.sou_super_admin()));

grant select, insert, update, delete on public.agenda to authenticated;

commit;
