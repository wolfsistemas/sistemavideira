# Push PWA - Sistema Videira

## 1. Banco

No SQL Editor do Supabase, rode:

`supabase/migrations/001_push_subscriptions.sql`

## 2. Secrets da Edge Function

No Dashboard: Project Settings > Edge Functions > Secrets

- `VAPID_PUBLIC_KEY` (a mesma do `config.js`)
- `VAPID_PRIVATE_KEY` (nunca no frontend)
- `VAPID_SUBJECT` = `mailto:contato@videirajatai.com.br`
- `PUSH_SECRET` = token longo (GAS e cron usam este header)

Ou via CLI:

```bash
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:contato@videirajatai.com.br" PUSH_SECRET="..."
```

## 3. Deploy

```bash
supabase functions deploy send-push --no-verify-jwt
```

`--no-verify-jwt` libera a chamada pelo GAS com `x-push-secret`.

## 4. Teste manual

```bash
curl -X POST "https://ctobdkstnrhepixyujms.supabase.co/functions/v1/send-push" \
  -H "Content-Type: application/json" \
  -H "x-push-secret: SEU_PUSH_SECRET" \
  -d '{"titulo":"Sistema Videira","corpo":"Teste de push","url":"./login.html","todos":true}'
```

## 5. Disparo automatico (eventos)

A Edge Function `notificar` recebe o webhook do banco e resolve os destinatarios.

- `supabase/migrations/002_push_triggers.sql`: cria o dispatcher `public.push_triggers_dispatch()` e os triggers de INSERT em `palavras`, `eventos`, `inscricoes_eventos`, `sugestoes` e `relatorios`.
- Regras: palavra/evento → todos; inscricao → pastores e discipuladores; oracao → pastores; relatorio → cadeia `superior_id` (discipulador + pastor).

Teste manual (com `dry_run` para nao enviar):

```bash
curl -X POST "https://ctobdkstnrhepixyujms.supabase.co/functions/v1/notificar" \
  -H "Content-Type: application/json" \
  -H "x-push-secret: SEU_PUSH_SECRET" \
  -d '{"table":"palavras","record":{"tema":"Teste"},"dry_run":true}'
```

## 6. Job diario (aniversariante + agenda)

- Edge Function `notificar-diario`: aniversariantes do dia → lider da celula; eventos com `data_evento` = hoje → todos.
- `supabase/migrations/003_push_cron.sql`: agenda via `pg_cron` as 09:00 America/Sao_Paulo (12:00 UTC).

Teste manual:

```bash
curl -X POST "https://ctobdkstnrhepixyujms.supabase.co/functions/v1/notificar-diario" \
  -H "Content-Type: application/json" \
  -H "x-push-secret: SEU_PUSH_SECRET" \
  -d '{"dry_run":true}'
```

## 7. Secret no Vault

Os triggers e o cron leem o `PUSH_SECRET` do Vault (nao fica no git):

```sql
select vault.create_secret('SEU_PUSH_SECRET', 'push_secret', 'Secret dos triggers de push');
```

## 8. Liga/desliga pelo Painel Admin

`supabase/migrations/004_push_config.sql` cria `public.push_config`. A aba **Notificacoes** do `admin.html` liga/desliga cada tipo. A chave `global` desliga tudo.

Chaves: `global`, `palavra`, `evento`, `inscricao`, `oracao`, `relatorio`, `aniversario`, `agenda`.

As Edge Functions `notificar` e `notificar-diario` leem essa tabela e ignoram o envio quando a chave estiver desligada.


