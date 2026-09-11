-- 003_push_cron.sql
-- Job diario: aniversariantes do dia e agenda do dia.
-- 09:00 America/Sao_Paulo = 12:00 UTC (pg_cron roda em UTC).
--
-- O secret de autorizacao fica no Vault sob o nome 'push_secret'.

create extension if not exists pg_cron;

create or replace function public.push_diario_dispatch()
returns void
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  v_secret text;
  v_url text := 'https://ctobdkstnrhepixyujms.supabase.co/functions/v1/notificar-diario';
begin
  select decrypted_secret
    into v_secret
    from vault.decrypted_secrets
   where name = 'push_secret'
   limit 1;

  if v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := jsonb_build_object('job', 'diario'),
    timeout_milliseconds := 10000
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'push-diario') then
    perform cron.unschedule('push-diario');
  end if;
end
$$;

select cron.schedule('push-diario', '0 12 * * *', 'select public.push_diario_dispatch()');
