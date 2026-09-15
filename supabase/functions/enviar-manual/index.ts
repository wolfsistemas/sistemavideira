import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizar(valor: unknown) {
  return (typeof valor === "string" ? valor : "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

type ManualBody = {
  titulo?: string;
  corpo?: string;
  url?: string;
  categorias?: string[];
  dry_run?: boolean;
};

async function idsPorCategorias(sb: SupabaseClient, categorias: string[]): Promise<string[]> {
  const { data, error } = await sb
    .from("pessoas")
    .select("id, categoria")
    .eq("is_user", true);
  if (error) throw new Error(error.message);

  const alvos = categorias.map(normalizar).filter(Boolean);
  return (data || [])
    .filter((p) => {
      const cat = normalizar(p.categoria);
      return cat && alvos.some((alvo) => cat === alvo || cat.includes(alvo));
    })
    .map((p) => p.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(401, { error: "unauthorized" });
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  const email = authData?.user?.email || "";
  if (authError || !email) {
    return json(401, { error: "unauthorized" });
  }

  const sb = createClient(url, service, { auth: { persistSession: false } });

  const { data: pessoa, error: pessoaError } = await sb
    .from("pessoas")
    .select("id, categoria")
    .ilike("email", email)
    .maybeSingle();
  if (pessoaError) return json(500, { error: pessoaError.message });
  if (normalizar(pessoa?.categoria) !== "administrador") {
    return json(403, { error: "forbidden" });
  }

  let body: ManualBody;
  try {
    body = await req.json();
  } catch (_e) {
    return json(400, { error: "invalid_json" });
  }

  const titulo = (body.titulo || "").trim() || "Aviso";
  const corpo = (body.corpo || "").trim();
  if (!corpo) return json(400, { error: "corpo_required" });
  const destino = (body.url || "").trim() || "./index.html";
  const categorias = (body.categorias || []).map((c) => String(c)).filter(Boolean);

  try {
    configurarVapid();
  } catch (e) {
    return json(500, { error: String(e) });
  }

  try {
    const ids = categorias.length ? await idsPorCategorias(sb, categorias) : null;
    if (ids && !ids.length) {
      return json(200, { ok: true, alvo: 0, enviados: 0, removidos: 0 });
    }

    let query = sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, pessoas!inner(id, is_user)");
    if (ids) {
      query = query.in("pessoa_id", ids);
    } else {
      query = query.eq("pessoas.is_user", true);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const pessoaIds = [...new Set((rows || []).map((r) => r.pessoas?.id).filter(Boolean))];

    if (body.dry_run === true) {
      return json(200, { ok: true, alvo: (rows || []).length, enviados: 0, removidos: 0, pessoaIds });
    }

    const payload = JSON.stringify({ title: titulo, body: corpo, url: destino });
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

    return json(200, { ok: true, alvo: (rows || []).length, enviados, removidos: expirados.length, pessoaIds });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
