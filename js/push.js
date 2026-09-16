(function () {
  function chaveParaBytes(base64Url) {
    const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  async function clienteSupabase(existente) {
    if (existente) return existente;
    if (typeof supabase === 'undefined') return null;
    const url = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : (typeof SB_URL !== 'undefined' ? SB_URL : '');
    const key = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : (typeof SB_KEY !== 'undefined' ? SB_KEY : '');
    if (!url || !key) return null;
    return supabase.createClient(url, key);
  }

  async function ativar(supabaseExistente) {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        console.warn('[push] navegador sem PushManager');
        return;
      }
      if (typeof VAPID_PUBLIC_KEY === 'undefined' || !VAPID_PUBLIC_KEY) {
        console.warn('[push] VAPID_PUBLIC_KEY ausente');
        return;
      }

      const sb = await clienteSupabase(supabaseExistente);
      if (!sb) {
        console.warn('[push] supabase indisponivel');
        return;
      }

      const { data: sessao } = await sb.auth.getUser();
      const user = sessao && sessao.user;
      if (!user || !user.email) {
        console.warn('[push] usuario nao autenticado');
        return;
      }

      if (Notification.permission === 'denied') {
        console.warn('[push] permissao negada');
        return;
      }
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }

      const registro = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise(function (_, reject) {
          setTimeout(function () { reject(new Error('service worker timeout')); }, 8000);
        })
      ]);
      let sub = await registro.pushManager.getSubscription();
      if (!sub) {
        sub = await Promise.race([
          registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY)
          }),
          new Promise(function (_, reject) {
            setTimeout(function () { reject(new Error('subscribe timeout')); }, 8000);
          })
        ]);
      }

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) {
        console.warn('[push] subscription incompleta', json);
        return;
      }

      // Caminho principal: RPC SECURITY DEFINER (migration 018). Ela faz o upsert
      // pelo endpoint assumindo a posse da assinatura, evitando o 403 quando o
      // navegador/aparelho e compartilhado por mais de uma pessoa.
      const { error: rpcErro } = await sb.rpc('registrar_push', {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_user_agent: navigator.userAgent
      });

      if (!rpcErro) {
        console.log('[push] subscription gravada');
        return;
      }

      // Fallback: RPC indisponivel (migration ainda nao aplicada). Grava direto;
      // so funciona quando a linha do endpoint ja pertence a esta pessoa.
      const { data: pessoa, error: pessoaErro } = await sb
        .from('pessoas')
        .select('id')
        .ilike('email', user.email)
        .maybeSingle();

      if (pessoaErro) {
        console.error('[push] erro ao buscar pessoa', pessoaErro);
        return;
      }
      if (!pessoa) {
        console.warn('[push] pessoa nao encontrada para', user.email);
        return;
      }

      const { error: upsertErro } = await sb.from('push_subscriptions').upsert({
        pessoa_id: pessoa.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });

      if (upsertErro) {
        console.error('[push] erro ao gravar subscription', upsertErro);
        return;
      }
      console.log('[push] subscription gravada (fallback)');
    } catch (e) {
      console.error('[push] falha', e);
    }
  }

  window.VideiraPush = { ativar: ativar };
})();
