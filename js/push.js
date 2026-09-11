(function () {
  function chaveParaBytes(base64Url) {
    const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + pad).replace(/-/g, '+').replace(/\//g, '/');
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (typeof VAPID_PUBLIC_KEY === 'undefined' || !VAPID_PUBLIC_KEY) return;

    const sb = await clienteSupabase(supabaseExistente);
    if (!sb) return;

    const { data: sessao } = await sb.auth.getUser();
    const user = sessao && sessao.user;
    if (!user || !user.email) return;

    if (Notification.permission === 'denied') return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }

    const registro = await navigator.serviceWorker.ready;
    let sub = await registro.pushManager.getSubscription();
    if (!sub) {
      sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY)
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) return;

    const { data: pessoa } = await sb
      .from('pessoas')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    if (!pessoa) return;

    await sb.from('push_subscriptions').upsert({
      pessoa_id: pessoa.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
  }

  window.VideiraPush = { ativar: ativar };
})();
