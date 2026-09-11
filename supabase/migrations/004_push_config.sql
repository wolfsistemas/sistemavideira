-- 004_push_config.sql
-- Liga/desliga cada tipo de notificacao pelo Painel Admin.
-- A chave 'global' desliga todas de uma vez.

create table if not exists public.push_config (
  chave text primary key,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into public.push_config (chave, ativo) values
  ('global', true),
  ('palavra', true),
  ('evento', true),
  ('inscricao', true),
  ('oracao', true),
  ('relatorio', true),
  ('aniversario', true),
  ('agenda', true)
on conflict (chave) do nothing;

alter table public.push_config enable row level security;

drop policy if exists push_config_select on public.push_config;
create policy push_config_select
  on public.push_config
  for select
  to authenticated
  using (true);

drop policy if exists push_config_insert on public.push_config;
create policy push_config_insert
  on public.push_config
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
        and categoria ilike '%admin%'
    )
  );

drop policy if exists push_config_update on public.push_config;
create policy push_config_update
  on public.push_config
  for update
  to authenticated
  using (
    exists (
      select 1 from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
        and categoria ilike '%admin%'
    )
  )
  with check (
    exists (
      select 1 from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
        and categoria ilike '%admin%'
    )
  );

grant select, insert, update on public.push_config to authenticated;
