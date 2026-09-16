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

  // A assinatura por cartao usa "preapproval_plan" (checkout de assinaturas do MP).
  // Reaproveita o plano da igreja enquanto o valor nao muda; se mudar, cria um novo.
  let planId = String(plano.preapproval_plan_id || "");
  let planInit = String(plano.preapproval_plan_init_point || "");
  if (!planId || !planInit || Number(plano.valor) !== Number(valor)) {
    const pl = await mpPost("/preapproval_plan", {
      reason: ("Sistema de Celulas - " + (ig.nome || "Igreja")).slice(0, 250),
      external_reference: ig.id,
      back_url: urlRetorno(req),
      notification_url: webhookUrl(),
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(valor),
        currency_id: "BRL",
      },
      payment_methods_allowed: { payment_types: [{ id: "credit_card" }] },
    });

    if (!pl.ok || !pl.body?.id || !pl.body?.init_point) {
      console.error("mp-criar-assinatura", pl.status, pl.body);
      return json(502, { erro: "mp", mensagem: pl.body?.message || "Falha ao criar a assinatura." });
    }

    planId = String(pl.body.id);
    planInit = String(pl.body.init_point);

    const config = (ig.config || {}) as Record<string, any>;
    const novoPlano = {
      ...(config.plano as Record<string, any> || {}),
      provedor: "mercadopago",
      modalidade: "mensal",
      metodo: "credito",
      valor: Number(valor),
      preapproval_plan_id: planId,
      preapproval_plan_init_point: planInit,
    };
    config.plano = novoPlano;
    await sb.from("igrejas").update({ config }).eq("id", ig.id);
  }

  return json(200, {
    ok: true,
    init_point: planInit,
    preapproval_plan_id: planId,
    valor: Number(valor),
  });
});
