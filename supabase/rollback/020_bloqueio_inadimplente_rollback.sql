-- rollback de 020_bloqueio_inadimplente.sql
-- Remove as policies de bloqueio e as funcoes de acesso.

do $$
declare
  t text;
  tabelas text[] := array[
    'agenda','anotacoes','arquivado','celulas','controle_apascentar','eventos',
    'financeiro','inscricoes_eventos','logs','palavras','pessoas','presencas',
    'push_config','push_subscriptions','relatorios','sugestoes'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop policy if exists %I on public.%I', 'liberado_ins_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'liberado_upd_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'liberado_del_' || t, t);
  end loop;
end $$;

drop function if exists public.acesso_igreja();
drop function if exists public.igreja_liberada(uuid);
