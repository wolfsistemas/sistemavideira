-- 017_igreja_info_plano.sql
-- (a) Amplia os dados cadastrais da igreja (config->'info') com endereco
--     estruturado, CEP, cidade/UF, e-mail da secretaria e horarios de culto.
-- (b) Adiciona o modelo minimo do plano/assinatura (config->'plano').
-- ADITIVO: apenas substitui/cria funcoes. NAO altera dados existentes.
--
-- FALLBACK (reverter): ver supabase/rollback/017_igreja_info_plano_rollback.sql
--   (a redefinicao de definir_igreja_info volta para a versao da migration 016)

begin;

-- (a) redefine a gravacao de info aceitando os novos campos ------------------
create or replace function public.definir_igreja_info(
  p_info jsonb,
  p_igreja_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja uuid;
  v_info   jsonb := '{}'::jsonb;
  v_chave  text;
  v_valor  text;
  c_chaves text[] := array[
    'razao_social','cnpj','endereco',
    'cep','logradouro','numero','bairro','cidade','uf','complemento',
    'telefone_pastor','email_secretaria','horarios_culto',
    'pastor_governo','pastor_supervisao',
    'instagram','facebook','site','whatsapp_secretaria',
    'banco','agencia','conta','tipo_conta','favorecido'
  ];
  c_limites jsonb := jsonb_build_object(
    'razao_social', 200, 'cnpj', 20, 'endereco', 300,
    'cep', 9, 'logradouro', 200, 'numero', 20, 'bairro', 120, 'cidade', 120,
    'uf', 2, 'complemento', 120,
    'telefone_pastor', 30, 'email_secretaria', 200, 'horarios_culto', 300,
    'pastor_governo', 120, 'pastor_supervisao', 120, 'instagram', 120, 'facebook', 120,
    'site', 200, 'whatsapp_secretaria', 30,
    'banco', 120, 'agencia', 30, 'conta', 40, 'tipo_conta', 40, 'favorecido', 200
  );
begin
  if not public.is_admin_or_pastor() and not public.sou_super_admin() then
    raise exception 'sem permissao para alterar os dados da igreja';
  end if;

  if p_igreja_id is not null and public.sou_super_admin() then
    v_igreja := p_igreja_id;
  else
    v_igreja := public.igreja_default();
  end if;

  if v_igreja is null then
    raise exception 'igreja nao identificada';
  end if;

  if p_info is null or jsonb_typeof(p_info) <> 'object' then
    raise exception 'dados invalidos';
  end if;

  foreach v_chave in array c_chaves loop
    if p_info ? v_chave then
      v_valor := btrim(coalesce(p_info ->> v_chave, ''));
      if char_length(v_valor) > coalesce((c_limites ->> v_chave)::int, 200) then
        raise exception 'campo % muito longo', v_chave;
      end if;
      v_info := v_info || jsonb_build_object(v_chave, nullif(v_valor, ''));
    end if;
  end loop;

  update public.igrejas
     set config = jsonb_set(coalesce(config, '{}'::jsonb), '{info}', v_info, true)
   where id = v_igreja;

  return v_info;
end;
$$;

-- (b) plano/assinatura --------------------------------------------------------
-- Le o plano da igreja efetiva (super admin pode informar p_igreja_id).
-- Retorna objeto vazio quando ainda nao ha plano cadastrado.
create or replace function public.igreja_plano(p_igreja_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select i.config -> 'plano'
       from public.igrejas i
      where i.id = case
                     when p_igreja_id is not null and public.sou_super_admin() then p_igreja_id
                     else public.igreja_default()
                   end
      limit 1),
    '{}'::jsonb
  );
$$;

-- Grava o plano da igreja. Somente o fornecedor (super admin) altera.
create or replace function public.definir_igreja_plano(
  p_plano jsonb,
  p_igreja_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja   uuid;
  v_plano    jsonb := '{}'::jsonb;
  v_nome     text := btrim(coalesce(p_plano ->> 'plano', ''));
  v_status   text := lower(btrim(coalesce(p_plano ->> 'status', '')));
  v_valor    text := btrim(coalesce(p_plano ->> 'valor', ''));
  v_dia      text := btrim(coalesce(p_plano ->> 'dia_vencimento', ''));
  v_inicio   text := btrim(coalesce(p_plano ->> 'inicio', ''));
  v_trial    text := btrim(coalesce(p_plano ->> 'trial_fim', ''));
  v_obs      text := btrim(coalesce(p_plano ->> 'observacao', ''));
begin
  if not public.sou_super_admin() then
    raise exception 'apenas o fornecedor pode alterar o plano';
  end if;

  if p_igreja_id is not null then
    v_igreja := p_igreja_id;
  else
    v_igreja := public.igreja_default();
  end if;

  if v_igreja is null then
    raise exception 'igreja nao identificada';
  end if;

  if p_plano is null or jsonb_typeof(p_plano) <> 'object' then
    raise exception 'dados invalidos';
  end if;

  if char_length(v_nome) > 60 then raise exception 'nome do plano muito longo'; end if;
  if v_status <> '' and v_status not in ('trial','ativo','isento','inadimplente','cancelado') then
    raise exception 'situacao invalida';
  end if;
  if char_length(v_obs) > 300 then raise exception 'observacao muito longa'; end if;

  if v_valor <> '' then
    if v_valor !~ '^[0-9]+([.][0-9]{1,2})?$' then raise exception 'valor invalido'; end if;
  end if;

  if v_dia <> '' then
    if v_dia !~ '^[0-9]{1,2}$' or (v_dia::int < 1 or v_dia::int > 31) then
      raise exception 'dia de vencimento invalido';
    end if;
  end if;

  if v_inicio <> '' and v_inicio !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'data de inicio invalida';
  end if;
  if v_trial <> '' and v_trial !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'data de trial invalida';
  end if;

  v_plano := jsonb_build_object(
    'plano',          nullif(v_nome, ''),
    'status',         nullif(v_status, ''),
    'valor',          case when v_valor = '' then null else (v_valor::numeric) end,
    'dia_vencimento', case when v_dia = '' then null else v_dia::int end,
    'inicio',         nullif(v_inicio, ''),
    'trial_fim',      nullif(v_trial, ''),
    'observacao',     nullif(v_obs, '')
  );

  update public.igrejas
     set config = jsonb_set(coalesce(config, '{}'::jsonb), '{plano}', v_plano, true)
   where id = v_igreja;

  return v_plano;
end;
$$;

grant execute on function public.definir_igreja_info(jsonb, uuid) to authenticated;
grant execute on function public.igreja_plano(uuid) to authenticated;
revoke execute on function public.definir_igreja_plano(jsonb, uuid) from public, anon;
grant execute on function public.definir_igreja_plano(jsonb, uuid) to authenticated;

commit;
