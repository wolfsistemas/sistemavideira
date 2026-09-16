-- rollback/017_igreja_info_plano_rollback.sql
-- Reverte a migration 017_igreja_info_plano.sql:
--   - remove as funcoes de plano (igreja_plano / definir_igreja_plano);
--   - devolve definir_igreja_info para a versao da migration 016 (sem os campos
--     de endereco estruturado/CEP/email/horarios na lista de aceitos).
-- Os dados ja gravados em igrejas.config NAO sao apagados (aditivo).

begin;

revoke execute on function public.definir_igreja_plano(jsonb, uuid) from authenticated;
revoke execute on function public.igreja_plano(uuid) from authenticated;
drop function if exists public.definir_igreja_plano(jsonb, uuid);
drop function if exists public.igreja_plano(uuid);

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
    'razao_social','cnpj','endereco','telefone_pastor','pastor_governo','pastor_supervisao',
    'instagram','facebook','site','whatsapp_secretaria',
    'banco','agencia','conta','tipo_conta','favorecido'
  ];
  c_limites jsonb := jsonb_build_object(
    'razao_social', 200, 'cnpj', 20, 'endereco', 300, 'telefone_pastor', 30,
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

grant execute on function public.definir_igreja_info(jsonb, uuid) to authenticated;

commit;
