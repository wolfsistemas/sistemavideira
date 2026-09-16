import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false } },
  );
}

export async function usuarioDoRequest(sb: SupabaseClient, req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

export type IgrejaInfo = { id: string; nome: string; config: Record<string, any> };

export async function igrejaDoUsuario(sb: SupabaseClient, email: string) {
  const { data } = await sb
    .from("pessoas")
    .select("igreja_id")
    .ilike("email", email || "")
    .limit(1);
  const igrejaId = data?.[0]?.igreja_id;
  if (!igrejaId) return null;
  const { data: ig } = await sb
    .from("igrejas")
    .select("id, nome, config")
    .eq("id", igrejaId)
    .maybeSingle();
  return (ig as IgrejaInfo) || null;
}

export async function configFinanceira(sb: SupabaseClient) {
  const { data } = await sb
    .from("config_global")
    .select("valor")
    .eq("chave", "financeiro")
    .maybeSingle();
  return (data?.valor || {}) as {
    valor_mensal?: number | null;
    valor_anual?: number | null;
    trial_dias?: number | null;
  };
}

export function resolverMensal(ig: IgrejaInfo, cfg: { valor_mensal?: number | null }) {
  const plano = (ig.config?.plano || {}) as Record<string, any>;
  const v = plano.valor ?? cfg.valor_mensal ?? null;
  return v === null || v === undefined ? null : Number(v);
}

export function resolverAnual(ig: IgrejaInfo, cfg: { valor_anual?: number | null }) {
  const plano = (ig.config?.plano || {}) as Record<string, any>;
  const v = plano.valor_anual ?? cfg.valor_anual ?? null;
  return v === null || v === undefined ? null : Number(v);
}

export function urlRetorno(req: Request) {
  const ref = req.headers.get("referer") || "";
  try {
    const u = new URL(ref);
    return `${u.origin}${u.pathname}?assinatura=retorno`;
  } catch (_) { /* segue */ }
  const origin = req.headers.get("origin") || "";
  if (origin) return `${origin}/?assinatura=retorno`;
  return "https://wolfsaas.com.br/sistemavideira/admin.html?assinatura=retorno";
}

export function webhookUrl() {
  return `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1/mp-webhook`;
}

export async function mpPost(path: string, body: unknown) {
  const token = Deno.env.get("MP_ACCESS_TOKEN") || "";
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(txt);
  } catch (_) {
    parsed = { message: txt };
  }
  return { ok: r.ok, status: r.status, body: parsed };
}

// Agora + N dias no fuso de Brasília (MP exige ISO8601 com offset).
export function expiracaoBrasil(dias: number) {
  const d = new Date(Date.now() + dias * 86400000 - 3 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}.000-03:00`;
}
