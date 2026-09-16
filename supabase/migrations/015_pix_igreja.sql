-- 015_pix_igreja.sql
-- Expoe/grava a chave PIX da igreja (aba Oferta) de forma isolada por igreja.
-- ADITIVO: apenas cria funcoes. NAO altera dados; a chave fica em igrejas.config->'pix'.
--
-- Por que: a chave PIX da oferta estava fixa no HTML (lider.html/membro.html) e o
-- QR era uma imagem estatica. Admin/Pastor precisa editar a chave por igreja e o QR
-- passa a ser gerado a partir dela. 'igrejas' tem RLS (so super admin le/escreve),
-- entao usamos funcoes SECURITY DEFINER para ler/escrever apenas a propria igreja.
--
-- FALLBACK (reverter): ver supabase/rollback/015_pix_igreja_rollback.sql

begin;

-- Le a configuracao PIX da igreja efetiva da requisicao:
--   logado -> minha_igreja(); anonimo -> header x-igreja-id; fallback igreja padrao.
-- Retorna objeto vazio quando a igreja ainda nao cadastrou a chave.
create or replace function public.pix_igreja()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select i.config -> 'pix'
       from public.igrejas i
      where i.id = public.igreja_default()
      limit 1),
    '{}'::jsonb
  );
$$;

-- Grava a configuracao PIX da propria igreja (admin/pastor) ou de qualquer igreja
-- (super admin, via p_igreja_id). Faz merge em igrejas.config sem apagar o resto.
create or replace function public.definir_pix_igreja(
  p_chave text,
  p_titular text default null,
  p_cidade text default null,
  p_igreja_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja uuid;
  v_chave  text := btrim(coalesce(p_chave, ''));
  v_titular text := btrim(coalesce(p_titular, ''));
  v_cidade  text := btrim(coalesce(p_cidade, ''));
  v_pix jsonb;
begin
  if not public.is_admin_or_pastor() and not public.sou_super_admin() then
    raise exception 'sem permissao para alterar a chave PIX';
  end if;

  if p_igreja_id is not null and public.sou_super_admin() then
    v_igreja := p_igreja_id;
  else
    v_igreja := public.igreja_default();
  end if;

  if v_igreja is null then
    raise exception 'igreja nao identificada';
  end if;

  if v_chave = '' then
    raise exception 'informe a chave PIX';
  end if;

  if char_length(v_chave) > 77 then
    raise exception 'chave PIX muito longa';
  end if;
  if char_length(v_titular) > 25 then
    raise exception 'titular muito longo';
  end if;
  if char_length(v_cidade) > 15 then
    raise exception 'cidade muito longa';
  end if;

  v_pix := jsonb_build_object(
    'chave', v_chave,
    'titular', nullif(v_titular, ''),
    'cidade', nullif(v_cidade, '')
  );

  update public.igrejas
     set config = jsonb_set(coalesce(config, '{}'::jsonb), '{pix}', v_pix, true)
   where id = v_igreja;

  return v_pix;
end;
$$;

grant execute on function public.pix_igreja() to anon, authenticated;
-- Por padrao o Postgres concede EXECUTE a PUBLIC; restringe a escrita a logados.
revoke execute on function public.definir_pix_igreja(text, text, text, uuid) from public, anon;
grant execute on function public.definir_pix_igreja(text, text, text, uuid) to authenticated;

commit;
