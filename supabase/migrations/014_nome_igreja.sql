-- 014_nome_igreja.sql
-- Expoe o NOME da igreja atual para uso no titulo/cabecalho das paginas.
-- ADITIVO: apenas cria uma funcao.
--
-- Por que: a tabela 'igrejas' tem RLS e so o super admin pode ler. Usuarios
-- comuns e paginas publicas precisam saber o proprio nome sem ver as outras
-- igrejas. A funcao resolve pela igreja do usuario logado (minha_igreja) ou,
-- em paginas publicas, pelo header x-igreja-id; fallback: igreja padrao.
--
-- FALLBACK: drop function if exists public.nome_igreja_atual();

begin;

create or replace function public.nome_igreja_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.nome
  from public.igrejas i
  where i.id = public.igreja_default()
  limit 1;
$$;

grant execute on function public.nome_igreja_atual() to anon, authenticated;

commit;
