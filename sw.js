const CACHE_NAME = 'videira-pwa-v18';
const PRECACHE = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './style.css',
  './logo.png',
  './icons/icon-192.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/badge.png',
  './js/pwa.js',
  './js/push.js',
  './js/pdf.js',
  './js/log-user.js',
  './js/ui.js',
  './js/vendor/qrcode.min.js',
  './offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function isNavegacao(request) {
  return request.mode === 'navigate' ||
    (request.method === 'GET' && request.headers.get('accept') && request.headers.get('accept').includes('text/html'));
}

function deveIgnorar(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
  return url.hostname.includes('supabase.co') ||
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.includes('/auth/v1/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (deveIgnorar(url)) return;

  if (isNavegacao(request) || url.pathname.endsWith('.html') || url.pathname.endsWith('/config.js')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('./offline.html') || await cache.match('./index.html');
    return fallback || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => undefined);
  return cached || network || Response.error();
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'Sistema Videira',
    body: 'Nova notificação',
    url: './index.html'
  };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {
    try {
      data.body = event.data.text();
    } catch (err) {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192-maskable.png',
      badge: './icons/badge.png',
      data: { url: data.url || './index.html' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if ('focus' in cliente) {
          cliente.focus();
          if ('navigate' in cliente) cliente.navigate(destino);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
