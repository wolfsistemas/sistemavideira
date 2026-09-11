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
