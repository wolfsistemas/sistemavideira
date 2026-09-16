import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  configFinanceira,
  corsHeaders,
  expiracaoBrasil,
  igrejaDoUsuario,
  json,
  mpPost,
  resolverAnual,
  serviceClient,
  urlRetorno,
  usuarioDoRequest,
  webhookUrl,
} from "../_shared/mp.ts";

function nomePayer(nome: string) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  const first = partes.shift() || "";
  const last = partes.join(" ");
  return { first_name: (first || "Responsavel").slice(0, 60), last_name: (last || ".").slice(0, 60) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { erro: "metodo_invalido" });

  const sb = serviceClient();
  const user = await usuarioDoRequest(sb, req);
  if (!user?.email) return json(401, { erro: "nao_autenticado" });

  const ig = await igrejaDoUsuario(sb, user.email);
  if (!ig) return json(403, { erro: "igreja_nao_encontrada" });

  const plano = (ig.config?.plano || {}) as Record<string, any>;
  if (plano.status === "isento") return json(400, { erro: "isento", mensagem: "Esta igreja e isenta de cobranca." });

  const cfg = await configFinanceira(sb);
  const valor = resolverAnual(ig, cfg);
  if (!valor || valor <= 0) {
    return json(400, { erro: "sem_valor", mensagem: "Valor anual nao definido. Fale com o suporte." });
  }

  const { data: pessoa } = await sb
    .from("pessoas")
    .select("nome")
    .ilike("email", user.email)
    .limit(1);
  const payer = nomePayer(pessoa?.[0]?.nome || "");

  const expiracao = expiracaoBrasil(3);
  const descricao = ("Plano anual - " + (ig.nome || "Igreja")).slice(0, 250);

  const r = await mpPost("/v1/payments", {
    transaction_amount: Number(valor),
    description: descricao,
    payment_method_id: "pix",
    external_reference: ig.id,
    notification_url: webhookUrl(),
    date_of_expiration: expiracao,
    metadata: { tipo: "anual", igreja_id: ig.id },
    payer: { email: user.email, first_name: payer.first_name, last_name: payer.last_name },
  });

  if (!r.ok) {
    console.error("mp-criar-pix-anual", r.status, r.body);
    return json(502, { erro: "mp", mensagem: r.body?.message || "Falha ao gerar o PIX." });
  }

  const pag = r.body || {};
  const td = pag.point_of_interaction?.transaction_data || {};

  await sb.from("cobrancas").insert({
    igreja_id: ig.id,
    tipo: "anual",
    metodo: "pix",
    status: "pendente",
    valor: Number(valor),
    descricao,
    data_vencimento: String(expiracao).slice(0, 10),
    mp_payment_id: pag.id ? String(pag.id) : null,
    referencia: ig.id,
    payload: pag,
  });

  return json(200, {
    ok: true,
    payment_id: pag.id ? String(pag.id) : null,
    valor: Number(valor),
    qr_code: td.qr_code || null,
    qr_code_base64: td.qr_code_base64 || null,
    ticket_url: td.ticket_url || pag.ticket_url || null,
    expira_em: expiracao,
  });
});
