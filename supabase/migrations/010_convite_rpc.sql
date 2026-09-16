-- 010_convite_rpc.sql
-- Fecha o vazamento da politica de convite: em vez de permitir SELECT/UPDATE em
-- toda linha com token_convite, o acesso passa a ser por RPC que exige o token
-- secreto. ADITIVO nos dados. Reversivel com
--   supabase/rollback/010_convite_rpc_rollback.sql

begin;

-- Le o convite pelo token (usado pelo completar-cadastro.html).
create or replace function public.buscar_convite(p_token text)
returns table(id uuid, usuario text, categoria text, superior_id uuid, igreja_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, p.usuario, p.categoria, p.superior_id, p.igreja_id
  from public.pessoas p
  where p.token_convite = p_token
  limit 1;
$$;

-- Conclui o cadastro do convite (grava e-mail/nome/superior, marca is_user e
-- consome o token). Exige o token secreto.
create or replace function public.concluir_cadastro_convite(
  p_token text,
  p_nome text,
  p_email text,
  p_superior_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.pessoas
     set nome = coalesce(nullif(p_nome, ''), nome),
         email = lower(p_email),
         superior_id = p_superior_id,
         is_user = true,
         token_convite = null
   where token_convite = p_token;

  if not found then
    raise exception 'Convite invalido ou ja utilizado';
  end if;
end;
$$;

grant execute on function public.buscar_convite(text) to anon, authenticated;
grant execute on function public.concluir_cadastro_convite(text, text, text, uuid) to anon, authenticated;

-- remove as politicas que permitiam listar/alterar convites em massa
drop policy if exists p_sel_pessoas_convite on public.pessoas;
drop policy if exists p_upd_pessoas_convite on public.pessoas;

commit;
