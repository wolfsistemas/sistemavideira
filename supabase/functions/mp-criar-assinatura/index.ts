import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  configFinanceira,
  corsHeaders,
  igrejaDoUsuario,
  json,
  mpPost,
  resolverMensal,
  serviceClient,
  urlRetorno,
  usuarioDoRequest,
  webhookUrl,
} from "../_shared/mp.ts";

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
  if (plano.preapproval_id && plano.mp_status === "authorized") {
    return json(400, { erro: "ja_assinante", mensagem: "Esta igreja ja possui assinatura ativa no cartao." });
  }

  const cfg = await configFinanceira(sb);
  const valor = resolverMensal(ig, cfg);
  if (!valor || valor <= 0) {
    return json(400, { erro: "sem_valor", mensagem: "Valor mensal nao definido. Fale com o suporte." });
  }

  const r = await mpPost("/preapproval", {
    reason: ("Sistema de Celulas - " + (ig.nome || "Igreja")).slice(0, 250),
    external_reference: ig.id,
    payer_email: user.email,
    back_url: urlRetorno(req),
    notification_url: webhookUrl(),
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: Number(valor),
      currency_id: "BRL",
    },
    status: "pending",
  });

  if (!r.ok) {
    console.error("mp-criar-assinatura", r.status, r.body);
    return json(502, { erro: "mp", mensagem: r.body?.message || "Falha ao criar a assinatura." });
  }

  const init = r.body?.init_point || r.body?.sandbox_init_point;
  if (!init) return json(502, { erro: "mp_sem_init_point" });

  return json(200, {
    ok: true,
    init_point: init,
    preapproval_id: r.body?.id || null,
    valor: Number(valor),
  });
});
