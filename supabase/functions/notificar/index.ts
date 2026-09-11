import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  dry_run?: boolean;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function autorizado(req: Request) {
  const secret = Deno.env.get("PUSH_SECRET") || "";
  const headerSecret = req.headers.get("x-push-secret") || "";
  if (secret && headerSecret && headerSecret === secret) return true;

  const auth = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true;

  return false;
}

function configurarVapid() {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  let vapidSubject = (Deno.env.get("VAPID_SUBJECT") || "").trim();

  if (!vapidPublic || !vapidPrivate) {
    throw new Error("vapid_not_configured");
  }
  if (!vapidSubject) {
    vapidSubject = "mailto:contato@videirajatai.com.br";
  } else if (!vapidSubject.includes(":") && vapidSubject.includes("@")) {
    vapidSubject = `mailto:${vapidSubject}`;
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

async function idsPorCategoria(sb: SupabaseClient, padrao: string): Promise<string[]> {
  const { data, error } = await sb
    .from("pessoas")
    .select("id")
    .ilike("categoria", padrao)
    .eq("is_user", true);
  if (error) throw new Error(error.message);
  return (data || []).map((p) => p.id);
}

async function idsPastoresEDiscipuladores(sb: SupabaseClient): Promise<string[]> {
  const [pastores, discipuladores] = await Promise.all([
    idsPorCategoria(sb, "%pastor%"),
    idsPorCategoria(sb, "%discipulador%"),
  ]);
  return [...new Set([...pastores, ...discipuladores])];
}

async function superioresDoLider(sb: SupabaseClient, liderId: string): Promise<string[]> {
  const alvos: string[] = [];
  let atual = liderId;

  for (let i = 0; i < 5; i++) {
    const { data, error } = await sb
      .from("pessoas")
      .select("id, superior_id")
      .eq("id", atual)
      .maybeSingle();
    if (error || !data || !data.superior_id) break;
    alvos.push(data.superior_id);
    atual = data.superior_id;
  }

  return alvos;
}

type Alvo =
  | { modo: "todos" }
  | { modo: "ids"; ids: string[] };

const CHAVE_POR_TABELA: Record<string, string> = {
  palavras: "palavra",
  eventos: "evento",
  inscricoes_eventos: "inscricao",
  sugestoes: "oracao",
  relatorios: "relatorio",
};

async function configPush(sb: SupabaseClient): Promise<Record<string, boolean>> {
  const { data, error } = await sb.from("push_config").select("chave, ativo");
  if (error) return {};
  const mapa: Record<string, boolean> = {};
  for (const row of data || []) mapa[row.chave] = row.ativo === true;
  return mapa;
}

function chaveAtiva(config: Record<string, boolean>, chave: string) {
  if (config.global === false) return false;
  return config[chave] !== false;
}

type Notificacao = {
  titulo: string;
  corpo: string;
  url: string;
  alvo: Alvo;
};

async function montarNotificacao(
  sb: SupabaseClient,
  table: string,
  record: Record<string, unknown>,
): Promise<Notificacao | { erro: string }> {
  const texto = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

  switch (table) {
    case "palavras":
      return {
        titulo: "Nova palavra publicada",
        corpo: texto(record.tema) || texto(record.texto).slice(0, 120) || "Confira a nova palavra.",
        url: "./membro.html",
        alvo: { modo: "todos" },
      };

    case "eventos":
      return {
        titulo: "Novo evento",
        corpo: texto(record.titulo) || texto(record.nome) || "Um novo evento foi publicado.",
        url: "./inscricao-evento.html",
        alvo: { modo: "todos" },
      };

    case "inscricoes_eventos": {
      const ids = await idsPastoresEDiscipuladores(sb);
      return {
        titulo: "Nova inscrição em evento",
        corpo: "Há uma nova inscrição em evento.",
        url: "./pastor.html",
        alvo: { modo: "ids", ids },
      };
    }

    case "sugestoes": {
      const ids = await idsPorCategoria(sb, "%pastor%");
      return {
        titulo: "Novo pedido de oração",
        corpo: texto(record.mensagem).slice(0, 120) || "Um novo pedido de oração foi enviado.",
        url: "./pastor.html",
        alvo: { modo: "ids", ids },
      };
    }

    case "relatorios": {
      const celulaId = texto(record.celula_id);
      let celulaNome = "célula";
      let liderId = "";

      if (celulaId) {
        const { data: cel } = await sb
          .from("celulas")
          .select("nome, lider_user_id")
          .eq("id", celulaId)
          .maybeSingle();
        if (cel) {
          celulaNome = texto(cel.nome, "célula");
          liderId = texto(cel.lider_user_id);
        }
      }

      const ids = liderId ? await superioresDoLider(sb, liderId) : [];
      return {
        titulo: "Novo relatório de célula",
        corpo: `${celulaNome} - ${texto(record.data)}`.trim(),
        url: "./discipulador.html",
        alvo: { modo: "ids", ids },
      };
    }

    default:
      return { erro: `tabela_nao_suportada:${table}` };
  }
}

async function enviar(sb: SupabaseClient, notificacao: Notificacao, dryRun = false) {
  let query = sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, pessoas!inner(id, is_user)");

  if (notificacao.alvo.modo === "todos") {
    query = query.eq("pessoas.is_user", true);
  } else {
    if (!notificacao.alvo.ids.length) {
      return { alvo: 0, enviados: 0, removidos: 0, pessoaIds: [] as string[] };
    }
    query = query.in("pessoa_id", notificacao.alvo.ids);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);

  const pessoaIds = [...new Set((rows || []).map((r) => r.pessoas?.id).filter(Boolean))];

  if (dryRun) {
    return { alvo: (rows || []).length, enviados: 0, removidos: 0, pessoaIds };
  }

  const payload = JSON.stringify({
    title: notificacao.titulo,
    body: notificacao.corpo,
    url: notificacao.url,
  });

  let enviados = 0;
  const expirados: string[] = [];

  for (const row of rows || []) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
      );
      enviados += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) expirados.push(row.id);
    }
  }

  if (expirados.length) {
    await sb.from("push_subscriptions").delete().in("id", expirados);
  }

  return { alvo: (rows || []).length, enviados, removidos: expirados.length, pessoaIds };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }
  if (!autorizado(req)) {
    return json(401, { error: "unauthorized" });
  }

  try {
    configurarVapid();
  } catch (e) {
    return json(500, { error: String(e) });
  }

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch (_e) {
    return json(400, { error: "invalid_json" });
  }

  const table = body.table || "";
  const record = body.record || {};
  if (!table) return json(400, { error: "table_required" });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  const chave = CHAVE_POR_TABELA[table];
  if (chave) {
    const config = await configPush(sb);
    if (!chaveAtiva(config, chave)) {
      return json(200, { ok: true, table, desativado: chave });
    }
  }

  const notificacao = await montarNotificacao(sb, table, record);
  if ("erro" in notificacao) {
    return json(200, { ok: true, ignorado: notificacao.erro });
  }

  try {
    const resultado = await enviar(sb, notificacao, body.dry_run === true);
    return json(200, { ok: true, table, ...resultado });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
