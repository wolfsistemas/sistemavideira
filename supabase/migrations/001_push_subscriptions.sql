create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_pessoa_id_idx
  on public.push_subscriptions (pessoa_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own
  on public.push_subscriptions
  for select
  to authenticated
  using (
    pessoa_id in (
      select id from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists push_insert_own on public.push_subscriptions;
create policy push_insert_own
  on public.push_subscriptions
  for insert
  to authenticated
  with check (
    pessoa_id in (
      select id from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists push_update_own on public.push_subscriptions;
create policy push_update_own
  on public.push_subscriptions
  for update
  to authenticated
  using (
    pessoa_id in (
      select id from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    pessoa_id in (
      select id from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own
  on public.push_subscriptions
  for delete
  to authenticated
  using (
    pessoa_id in (
      select id from public.pessoas
      where lower(email) = lower(auth.jwt() ->> 'email')
    )
  );

grant select, insert, update, delete on public.push_subscriptions to authenticated;
