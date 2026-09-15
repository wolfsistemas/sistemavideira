-- 005_eventos_inscricoes.sql
-- Suporte a PIX, controle manual de inscricoes, comprovante e e-mail de confirmacao.
--
-- Execute no SQL Editor do Supabase (ou via supabase db push).
-- Todas as operacoes sao idempotentes.

-- 1) Colunas novas em eventos
alter table if exists public.eventos
  add column if not exists pix_chave text,
  add column if not exists inscricoes_abertas boolean not null default true;

-- 2) Coluna de comprovante em inscricoes_eventos
alter table if exists public.inscricoes_eventos
  add column if not exists comprovante_url text,
  add column if not exists email_confirmacao_enviado boolean not null default false;

-- 3) Bucket de comprovantes (leitura publica; upload pelo link publico de inscricao)
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', true)
on conflict (id) do update set public = true;

-- 4) Policies do bucket 'comprovantes' (idempotente)
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

-- 5) RLS minimo para o fluxo publico (idempotente e sem redundancia).
--    So cria a policy se ainda NAO houver nenhuma SELECT/INSERT publica.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'eventos' and cmd = 'SELECT'
  ) then
    create policy eventos_select_publico on public.eventos
      for select to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'inscricoes_eventos' and cmd = 'INSERT'
  ) then
    create policy inscricoes_insert_publico on public.inscricoes_eventos
      for insert to anon, authenticated
      with check (true);
  end if;
end
$$;
