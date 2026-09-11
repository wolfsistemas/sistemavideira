import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TZ = "America/Sao_Paulo";

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

  if (!vapidPublic || !vapidPrivate) throw new Error("vapid_not_configured");
  if (!vapidSubject) {
    vapidSubject = "mailto:contato@videirajatai.com.br";
  } else if (!vapidSubject.includes(":") && vapidSubject.includes("@")) {
    vapidSubject = `mailto:${vapidSubject}`;
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

function dataHoje(): { iso: string; mes: string; dia: string } {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { iso: hoje, mes: hoje.slice(5, 7), dia: hoje.slice(8, 10) };
}

type Alvo = { modo: "todos" } | { modo: "ids"; ids: string[] };

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

async function enviar(
  sb: SupabaseClient,
  titulo: string,
  corpo: string,
  url: string,
  alvo: Alvo,
  dryRun: boolean,
) {
  let query = sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, pessoa_id, pessoas!inner(id, is_user)");

  if (alvo.modo === "todos") {
    query = query.eq("pessoas.is_user", true);
  } else {
    if (!alvo.ids.length) return { alvo: 0, enviados: 0, removidos: 0 };
    query = query.in("pessoa_id", alvo.ids);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (dryRun) return { alvo: (rows || []).length, enviados: 0, removidos: 0 };

  const payload = JSON.stringify({ title: titulo, body: corpo, url });
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

  return { alvo: (rows || []).length, enviados, removidos: expirados.length };
}

async function notificarAniversariantes(sb: SupabaseClient, dryRun: boolean) {
  const { iso, mes, dia } = dataHoje();

  const { data: pessoas, error } = await sb
    .from("pessoas")
    .select("id, nome, nascimento, celula_id")
    .not("nascimento", "is", null)
    .not("celula_id", "is", null)
    .eq("arquivado", false);
  if (error) throw new Error(error.message);

  const aniversariantes = (pessoas || []).filter((p) => {
    const n = String(p.nascimento || "");
    return n.slice(5, 7) === mes && n.slice(8, 10) === dia;
  });

  if (!aniversariantes.length) return { data: iso, aniversariantes: 0, lideres: 0, resultado: [] };

  const celulaIds = [...new Set(aniversariantes.map((p) => p.celula_id).filter(Boolean))];
  const { data: celulas } = await sb.from("celulas").select("id, nome, lider_user_id").in("id", celulaIds);

  const porLider = new Map<string, string[]>();
  let semLider = 0;

  for (const a of aniversariantes) {
    const cel = (celulas || []).find((c) => c.id === a.celula_id);
    const lider = cel?.lider_user_id;
    if (!lider) {
      semLider += 1;
      continue;
    }
    const nomes = porLider.get(lider) || [];
    nomes.push(a.nome || "Aniversariante");
    porLider.set(lider, nomes);
  }

  const resultado = [];
  for (const [liderId, nomes] of porLider) {
    const corpo = nomes.length === 1
      ? `Hoje é aniversário de ${nomes[0]}. Parabéns!`
      : `Hoje é aniversário de: ${nomes.join(", ")}.`;
    const r = await enviar(
      sb,
      "Aniversariante do dia",
      corpo,
      "./lider.html",
      { modo: "ids", ids: [liderId] },
      dryRun,
    );
    resultado.push({ liderId, nomes, ...r });
  }

  return { data: iso, aniversariantes: aniversariantes.length, lideres: porLider.size, semLider, resultado };
}

async function notificarAgenda(sb: SupabaseClient, dryRun: boolean) {
  const { iso } = dataHoje();

  const { data: eventos, error } = await sb
    .from("eventos")
    .select("id, nome, hora_evento, local")
    .eq("data_evento", iso)
    .or("ativo.is.null,ativo.eq.true");
  if (error) throw new Error(error.message);

  if (!eventos || !eventos.length) return { data: iso, eventos: 0, resultado: null };

  const corpo = eventos
    .map((e) => {
      const hora = String(e.hora_evento || "").slice(0, 5);
      return [e.nome || "Evento", hora, e.local].filter(Boolean).join(" - ");
    })
    .join(" | ");

  const r = await enviar(sb, "Agenda de hoje", corpo, "./membro.html", { modo: "todos" }, dryRun);
  return { data: iso, eventos: eventos.length, resultado: r };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!autorizado(req)) return json(401, { error: "unauthorized" });

  try {
    configurarVapid();
  } catch (e) {
    return json(500, { error: String(e) });
  }

  let body: { dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }
  const dryRun = body.dry_run === true;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  try {
    const config = await configPush(sb);
    const aniversariantes = chaveAtiva(config, "aniversario")
      ? await notificarAniversariantes(sb, dryRun)
      : { desativado: true };
    const agenda = chaveAtiva(config, "agenda")
      ? await notificarAgenda(sb, dryRun)
      : { desativado: true };
    return json(200, { ok: true, dry_run: dryRun, aniversariantes, agenda });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
