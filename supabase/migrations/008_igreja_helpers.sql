-- 008_igreja_helpers.sql
-- Funcoes auxiliares de escopo por igreja. ADITIVO: apenas cria funcoes.
--
-- FALLBACK (reverter):
--   drop function if exists public.igreja_default();
--   drop function if exists public.igreja_requisicao();
--   drop function if exists public.minha_igreja();

begin;

-- Igreja do usuario autenticado (pessoas vinculada por e-mail do JWT).
-- SECURITY DEFINER para ler pessoas sem cair na propria RLS (evita recursao).
create or replace function public.minha_igreja()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.igreja_id
  from public.pessoas p
  where lower(p.email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

-- Igreja efetiva da requisicao: a do usuario logado; se anonimo, o header
-- 'x-igreja-id' enviado pelo app (paginas publicas).
create or replace function public.igreja_requisicao()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    public.minha_igreja(),
    nullif((nullif(current_setting('request.headers', true), '')::json ->> 'x-igreja-id'), '')::uuid
  );
$$;

-- Fallback final (igreja atual), para nao quebrar inserts anonimos legados.
create or replace function public.igreja_default()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    public.igreja_requisicao(),
    (select id from public.igrejas where slug = 'videira-jatai' limit 1)
  );
$$;

grant execute on function public.minha_igreja() to anon, authenticated;
grant execute on function public.igreja_requisicao() to anon, authenticated;
grant execute on function public.igreja_default() to anon, authenticated;

commit;
