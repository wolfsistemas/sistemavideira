import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") || "";
const MP_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") || "";
const MP_API = "https://api.mercadopago.com";

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function assinaturaValida(req: Request, dataId: string) {
  if (!MP_SECRET) return true; // secret ainda não configurada
  const sig = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  if (!sig) return false;

  const partes: Record<string, string> = {};
  sig.split(",").forEach((p) => {
    const [k, v] = p.split("=");
    if (k && v) partes[k.trim()] = v.trim();
  });
  if (!partes.ts || !partes.v1) return false;

  const alvo = String(dataId || "");
  const manifestos = [
    `id:${alvo};request-id:${requestId};ts:${partes.ts};`,
    `id:${alvo.toLowerCase()};request-id:${requestId};ts:${partes.ts};`,
  ];
  for (const m of manifestos) {
    if (iguais(await hmacSha256Hex(MP_SECRET, m), partes.v1)) return true;
  }
  return false;
}

async function mpGet(path: string) {
  const r = await fetch(`${MP_API}${path}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!r.ok) throw new Error(`mp ${path} -> ${r.status}`);
  return await r.json();
}

function mapPagamento(status: string) {
  switch (status) {
    case "approved":
      return "aprovado";
    case "pending":
    case "authorized":
      return "pendente";
    case "in_process":
      return "em_processamento";
    case "rejected":
      return "recusado";
    case "cancelled":
      return "cancelado";
    case "refunded":
    case "charged_back":
      return "reembolsado";
    default:
      return "pendente";
  }
}

function mapPreapproval(status: string) {
  switch (status) {
    case "authorized":
      return "ativo";
    case "paused":
      return "inadimplente";
    case "cancelled":
      return "cancelado";
    default:
      return "trial";
  }
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function somarMeses(base: Date, meses: number) {
  const d = new Date(base.getTime());
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses);
  if (d.getUTCDate() < dia) d.setUTCDate(0);
  return d;
}

async function configDa(sb: SupabaseClient, igrejaId: string) {
  const { data } = await sb.from("igrejas").select("config").eq("id", igrejaId).maybeSingle();
  return (data?.config || {}) as Record<string, unknown>;
}

async function salvarPlano(sb: SupabaseClient, igrejaId: string, patch: Record<string, unknown>) {
  const config = await configDa(sb, igrejaId);
  const plano = { ...((config.plano as Record<string, unknown>) || {}), ...patch };
  config.plano = plano;
  await sb.from("igrejas").update({ config }).eq("id", igrejaId);
  return plano;
}

async function acharPorPreapproval(sb: SupabaseClient, preapprovalId: string) {
  const { data } = await sb.from("igrejas").select("id, config");
  const achou = (data || []).find((r) => {
    const plano = (r.config && r.config.plano) || {};
    return String(plano.preapproval_id || "") === String(preapprovalId);
  });
  return achou?.id as string | undefined;
}

function extrairTipo(pay: Record<string, any>) {
  const meta = pay.metadata || {};
  if (meta.tipo === "anual" || meta.tipo === "mensal") return meta.tipo as string;
  return pay.preapproval_id ? "mensal" : "anual";
}

function extrairMetodo(pay: Record<string, any>) {
  if (pay.payment_type_id === "credit_card") return "credito";
  if (pay.payment_method_id === "pix" || pay.payment_type_id === "bank_transfer") return "pix";
  return pay.payment_method_id || null;
}

async function processarPagamento(sb: SupabaseClient, id: string) {
  const pay = await mpGet(`/v1/payments/${id}`);
  const tipo = extrairTipo(pay);
  const status = mapPagamento(String(pay.status || ""));

  let igrejaId = pay.external_reference as string | undefined;
  if (!igrejaId && pay.preapproval_id) {
    igrejaId = await acharPorPreapproval(sb, String(pay.preapproval_id));
  }
  if (!igrejaId) {
    console.warn("mp-webhook: pagamento sem igreja", pay.id);
    return;
  }

  const cobranca: Record<string, unknown> = {
    igreja_id: igrejaId,
    tipo,
    metodo: extrairMetodo(pay),
    status,
    valor: Number(pay.transaction_amount || 0),
    descricao: pay.description || null,
    data_pagamento: pay.date_approved || null,
    mp_preapproval_id: pay.preapproval_id ? String(pay.preapproval_id) : null,
    referencia: pay.external_reference || null,
    payload: pay,
  };
  if (pay.id) cobranca.mp_payment_id = String(pay.id);

  const conflito = cobranca.mp_payment_id ? "mp_payment_id" : undefined;
  await sb.from("cobrancas").upsert(cobranca, conflito ? { onConflict: conflito } : {});

  if (status !== "aprovado") return;

  if (tipo === "anual") {
    const config = await configDa(sb, igrejaId);
    const plano = (config.plano as Record<string, any>) || {};
    const hoje = new Date();
    const atual = plano.acesso_ate ? new Date(plano.acesso_ate) : null;
    const base = atual && atual > hoje ? atual : hoje;
    const acesso = somarMeses(base, 12);
    await salvarPlano(sb, igrejaId, {
      provedor: "mercadopago",
      modalidade: "anual",
      metodo: "pix",
      status: "ativo",
      mp_status: pay.status,
      valor_anual: Number(pay.transaction_amount || 0),
      acesso_ate: acesso.toISOString().slice(0, 10),
      proximo_vencimento: acesso.toISOString().slice(0, 10),
    });
  } else {
    await salvarPlano(sb, igrejaId, {
      provedor: "mercadopago",
      modalidade: "mensal",
      metodo: "credito",
      status: "ativo",
      mp_status: pay.status,
    });
  }
}

async function processarPreapproval(sb: SupabaseClient, id: string) {
  const pre = await mpGet(`/preapproval/${id}`);
  let igrejaId = pre.external_reference as string | undefined;
  if (!igrejaId) igrejaId = await acharPorPreapproval(sb, String(pre.id));
  if (!igrejaId) {
    console.warn("mp-webhook: assinatura sem igreja", pre.id);
    return;
  }

  const auto = pre.auto_recurring || {};
  await salvarPlano(sb, igrejaId, {
    provedor: "mercadopago",
    modalidade: "mensal",
    metodo: "credito",
    status: mapPreapproval(String(pre.status || "")),
    mp_status: pre.status,
    preapproval_id: String(pre.id),
    payer_id: pre.payer_id ? String(pre.payer_id) : null,
    valor: auto.transaction_amount != null ? Number(auto.transaction_amount) : undefined,
    proximo_vencimento: pre.next_payment_date || null,
  });
}

async function processarAssinaturaPagamento(sb: SupabaseClient, id: string) {
  const ap = await mpGet(`/authorized_payments/${id}`);
  const preapprovalId = ap.preapproval_id ? String(ap.preapproval_id) : "";
  let igrejaId = await acharPorPreapproval(sb, preapprovalId);
  if (!igrejaId) {
    console.warn("mp-webhook: cobrança de assinatura sem igreja", id);
    return;
  }
  const pgto = ap.payment || {};
  const status = mapPagamento(String(pgto.status || ap.status || ""));

  const cobranca: Record<string, unknown> = {
    igreja_id: igrejaId,
    tipo: "mensal",
    metodo: "credito",
    status,
    valor: Number(ap.transaction_amount || 0),
    data_pagamento: status === "aprovado" ? (pgto.date_approved || ap.date_created || null) : null,
    mp_payment_id: pgto.id ? String(pgto.id) : null,
    mp_preapproval_id: preapprovalId || null,
    referencia: preapprovalId,
    payload: ap,
  };
  await sb.from("cobrancas").upsert(cobranca, cobranca.mp_payment_id ? { onConflict: "mp_payment_id" } : {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);
  let body: Record<string, any> = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }

  const type = String(body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "");
  const dataId = String(body.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");

  if (!type || !dataId) {
    return json(200, { ok: true, ignorado: true });
  }

  if (!(await assinaturaValida(req, dataId))) {
    console.warn("mp-webhook: assinatura invalida", type, dataId);
    return json(401, { ok: false, erro: "assinatura_invalida" });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { auth: { persistSession: false } },
  );

  try {
    switch (type) {
      case "payment":
        await processarPagamento(sb, dataId);
        break;
      case "preapproval":
      case "subscription_preapproval":
      case "plan":
        await processarPreapproval(sb, dataId);
        break;
      case "subscription_authorized_payment":
        await processarAssinaturaPagamento(sb, dataId);
        break;
      default:
        console.log("mp-webhook: tipo ignorado", type);
    }
  } catch (e) {
    console.error("mp-webhook erro:", type, dataId, e);
    return json(200, { ok: false, processado: false });
  }

  return json(200, { ok: true });
});
