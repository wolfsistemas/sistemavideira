-- 011_push_config_por_igreja.sql
-- Torna push_config realmente multi-tenant (ADITIVO):
--  - a PK deixa de ser (chave) e passa a ser (igreja_id, chave),
--    permitindo que cada igreja tenha suas proprias 8 chaves;
--  - semeia as 8 chaves para todas as igrejas existentes;
--  - trigger semeia automaticamente as 8 chaves ao criar uma igreja.
--
-- Nenhum dado existente e alterado/excluido.
--
-- FALLBACK: ver supabase/rollback/011_push_config_por_igreja_rollback.sql

begin;

-- 1) Troca a primary key (nao altera linhas)
alter table public.push_config drop constraint if exists push_config_pkey;
alter table public.push_config
  add constraint push_config_pkey primary key (igreja_id, chave);

-- 2) Seed idempotente das 8 chaves para todas as igrejas existentes
insert into public.push_config (igreja_id, chave, ativo)
select i.id, c.chave, true
from public.igrejas i
cross join (
  values ('global'),('palavra'),('evento'),('inscricao'),
         ('oracao'),('relatorio'),('aniversario'),('agenda')
) as c(chave)
on conflict (igreja_id, chave) do nothing;

-- 3) Seed automatico para igrejas novas
create or replace function public.push_config_seed_igreja()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.push_config (igreja_id, chave, ativo)
  select new.id, c.chave, true
  from (
    values ('global'),('palavra'),('evento'),('inscricao'),
           ('oracao'),('relatorio'),('aniversario'),('agenda')
  ) as c(chave)
  on conflict (igreja_id, chave) do nothing;
  return new;
end;
$$;

drop trigger if exists push_config_seed_nova_igreja on public.igrejas;
create trigger push_config_seed_nova_igreja
  after insert on public.igrejas
  for each row execute function public.push_config_seed_igreja();

commit;
