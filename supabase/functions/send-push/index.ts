import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  titulo?: string;
  title?: string;
  corpo?: string;
  body?: string;
  url?: string;
  pessoa_ids?: string[];
  categorias?: string[];
  todos?: boolean;
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

  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  let vapidSubject = (Deno.env.get("VAPID_SUBJECT") || "").trim();

  if (!vapidPublic || !vapidPrivate) {
    return json(500, { error: "vapid_not_configured" });
  }

  if (!vapidSubject) {
    vapidSubject = "mailto:contato@videirajatai.com.br";
  } else if (!vapidSubject.includes(":") && vapidSubject.includes("@")) {
    vapidSubject = `mailto:${vapidSubject}`;
  }

  try {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (e) {
    return json(500, { error: "vapid_invalido", detail: String(e) });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch (_e) {
    return json(400, { error: "invalid_json" });
  }

  const titulo = (body.titulo || body.title || "Sistema Videira").trim();
  const corpo = (body.corpo || body.body || "").trim();
  const url = body.url || "./index.html";

  if (!corpo) {
    return json(400, { error: "body_required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );

  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, pessoa_id, pessoas!inner(id, categoria, is_user)");

  if (body.todos) {
    query = query.eq("pessoas.is_user", true);
  } else if (body.pessoa_ids && body.pessoa_ids.length) {
    query = query.in("pessoa_id", body.pessoa_ids);
  } else if (body.categorias && body.categorias.length) {
    query = query.in("pessoas.categoria", body.categorias);
  } else {
    return json(400, { error: "missing_target" });
  }

  const { data: rows, error } = await query;
  if (error) {
    return json(500, { error: error.message });
  }

  const payload = JSON.stringify({ title: titulo, body: corpo, url });
  let enviados = 0;
  const expirados: string[] = [];

  for (const row of rows || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
      );
      enviados += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        expirados.push(row.id);
      }
    }
  }

  if (expirados.length) {
    await supabase.from("push_subscriptions").delete().in("id", expirados);
  }

  return json(200, {
    ok: true,
    alvo: (rows || []).length,
    enviados,
    removidos: expirados.length,
  });
});
