-- 002_push_triggers.sql
-- Dispara notificacoes Web Push automaticas a partir de eventos no banco.
--
-- O secret de autorizacao da Edge Function fica no Vault sob o nome 'push_secret'.
-- A Edge Function 'notificar' resolve os destinatarios de cada evento.

create extension if not exists pg_net;

create or replace function public.push_triggers_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_secret text;
  v_url text := 'https://ctobdkstnrhepixyujms.supabase.co/functions/v1/notificar';
  v_body jsonb;
begin
  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
   where name = 'push_secret'
   limit 1;

  if v_secret is null then
    return new;
  end if;

  v_body := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'record', to_jsonb(new)
  );

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := v_body,
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists push_notify_palavras on public.palavras;
create trigger push_notify_palavras
  after insert on public.palavras
  for each row execute function public.push_triggers_dispatch();

drop trigger if exists push_notify_eventos on public.eventos;
create trigger push_notify_eventos
  after insert on public.eventos
  for each row execute function public.push_triggers_dispatch();

drop trigger if exists push_notify_inscricoes_eventos on public.inscricoes_eventos;
create trigger push_notify_inscricoes_eventos
  after insert on public.inscricoes_eventos
  for each row execute function public.push_triggers_dispatch();

drop trigger if exists push_notify_sugestoes on public.sugestoes;
create trigger push_notify_sugestoes
  after insert on public.sugestoes
  for each row execute function public.push_triggers_dispatch();

drop trigger if exists push_notify_relatorios on public.relatorios;
create trigger push_notify_relatorios
  after insert on public.relatorios
  for each row execute function public.push_triggers_dispatch();
