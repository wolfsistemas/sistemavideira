-- 006_multi_tenant.sql
-- Fundacao multi-tenant. ADITIVO e reversivel: nao exclui nem altera valores existentes.
-- Apenas cria a tabela igrejas, adiciona igreja_id (com default da igreja atual),
-- faz backfill das linhas existentes e marca super_admin em pessoas.
--
-- NAO liga/ajusta RLS (fica para a etapa final).
--
-- FALLBACK (reverter manualmente, sem tocar nos dados originais):
--   alter table public.<t> alter column igreja_id drop default;
--   alter table public.<t> drop constraint <t>_igreja_id_fkey;
--   alter table public.<t> drop column igreja_id;
--   alter table public.pessoas drop column super_admin;
--   drop table public.igrejas;

begin;

create table if not exists public.igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativa boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- Igreja atual (primeira). UUID fixo para ser deterministico/reproduzivel.
insert into public.igrejas (id, nome, slug)
values ('b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b', 'Videira Jataí', 'videira-jatai')
on conflict (slug) do nothing;

-- Marcador do super admin do fornecedor (acesso global futuro).
alter table public.pessoas add column if not exists super_admin boolean not null default false;

-- anotacoes
alter table public.anotacoes add column if not exists igreja_id uuid;
update public.anotacoes set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.anotacoes alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'anotacoes_igreja_id_fkey') then
    alter table public.anotacoes add constraint anotacoes_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_anotacoes_igreja_id on public.anotacoes(igreja_id);
-- arquivado
alter table public.arquivado add column if not exists igreja_id uuid;
update public.arquivado set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.arquivado alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'arquivado_igreja_id_fkey') then
    alter table public.arquivado add constraint arquivado_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_arquivado_igreja_id on public.arquivado(igreja_id);
-- celulas
alter table public.celulas add column if not exists igreja_id uuid;
update public.celulas set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.celulas alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'celulas_igreja_id_fkey') then
    alter table public.celulas add constraint celulas_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_celulas_igreja_id on public.celulas(igreja_id);
-- controle_apascentar
alter table public.controle_apascentar add column if not exists igreja_id uuid;
update public.controle_apascentar set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.controle_apascentar alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'controle_apascentar_igreja_id_fkey') then
    alter table public.controle_apascentar add constraint controle_apascentar_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_controle_apascentar_igreja_id on public.controle_apascentar(igreja_id);
-- eventos
alter table public.eventos add column if not exists igreja_id uuid;
update public.eventos set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.eventos alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_igreja_id_fkey') then
    alter table public.eventos add constraint eventos_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_eventos_igreja_id on public.eventos(igreja_id);
-- financeiro
alter table public.financeiro add column if not exists igreja_id uuid;
update public.financeiro set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.financeiro alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'financeiro_igreja_id_fkey') then
    alter table public.financeiro add constraint financeiro_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_financeiro_igreja_id on public.financeiro(igreja_id);
-- inscricoes_eventos
alter table public.inscricoes_eventos add column if not exists igreja_id uuid;
update public.inscricoes_eventos set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.inscricoes_eventos alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'inscricoes_eventos_igreja_id_fkey') then
    alter table public.inscricoes_eventos add constraint inscricoes_eventos_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_inscricoes_eventos_igreja_id on public.inscricoes_eventos(igreja_id);
-- logs
alter table public.logs add column if not exists igreja_id uuid;
update public.logs set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.logs alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'logs_igreja_id_fkey') then
    alter table public.logs add constraint logs_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_logs_igreja_id on public.logs(igreja_id);
-- palavras
alter table public.palavras add column if not exists igreja_id uuid;
update public.palavras set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.palavras alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'palavras_igreja_id_fkey') then
    alter table public.palavras add constraint palavras_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_palavras_igreja_id on public.palavras(igreja_id);
-- pessoas
alter table public.pessoas add column if not exists igreja_id uuid;
update public.pessoas set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.pessoas alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pessoas_igreja_id_fkey') then
    alter table public.pessoas add constraint pessoas_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_pessoas_igreja_id on public.pessoas(igreja_id);
-- presencas
alter table public.presencas add column if not exists igreja_id uuid;
update public.presencas set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.presencas alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'presencas_igreja_id_fkey') then
    alter table public.presencas add constraint presencas_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_presencas_igreja_id on public.presencas(igreja_id);
-- push_config
alter table public.push_config add column if not exists igreja_id uuid;
update public.push_config set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.push_config alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_config_igreja_id_fkey') then
    alter table public.push_config add constraint push_config_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_push_config_igreja_id on public.push_config(igreja_id);
-- push_subscriptions
alter table public.push_subscriptions add column if not exists igreja_id uuid;
update public.push_subscriptions set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.push_subscriptions alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_igreja_id_fkey') then
    alter table public.push_subscriptions add constraint push_subscriptions_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_push_subscriptions_igreja_id on public.push_subscriptions(igreja_id);
-- relatorios
alter table public.relatorios add column if not exists igreja_id uuid;
update public.relatorios set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.relatorios alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'relatorios_igreja_id_fkey') then
    alter table public.relatorios add constraint relatorios_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_relatorios_igreja_id on public.relatorios(igreja_id);
-- sugestoes
alter table public.sugestoes add column if not exists igreja_id uuid;
update public.sugestoes set igreja_id = 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid where igreja_id is null;
alter table public.sugestoes alter column igreja_id set default 'b7e3f1a2-5c4d-4e6f-8a9b-1c2d3e4f5a6b'::uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sugestoes_igreja_id_fkey') then
    alter table public.sugestoes add constraint sugestoes_igreja_id_fkey
      foreign key (igreja_id) references public.igrejas(id) on delete restrict;
  end if;
end $$;
create index if not exists idx_sugestoes_igreja_id on public.sugestoes(igreja_id);

commit;
