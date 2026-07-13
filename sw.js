// Service worker — network-first con fallback cache.
// Bump CACHE_VERSION ad ogni deploy: l'install riscarica l'intero shell
// (moduli inclusi) bypassando la HTTP cache, così il set in cache è sempre
// atomico e coerente con l'ultimo deploy.
const CACHE_VERSION = 'lastmile-v2';
const SHELL = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './avr-logo.png',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/firebase.js',
  './js/state.js',
  './js/utils.js',
  './js/data.js',
  './js/auth.js',
  './js/turno.js',
  './js/nav.js',
  './js/views/oggi.js',
  './js/views/nuova.js',
  './js/views/ritorno.js',
  './js/views/segnala.js',
  './js/views/classifica.js',
  './js/views/compensi.js',
  './js/views/profilo.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE_VERSION);
    // cache:'reload' bypassa la HTTP cache del browser: il precache contiene
    // sempre il set atomico dell'ultimo deploy, mai un mix di versioni.
    await c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  // Solo GET same-origin: Firebase/fonts passano diretti alla rete.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    try {
      // cache:'no-cache' forza la rivalidazione con GitHub Pages (ETag):
      // dopo un deploy i driver ricevono subito i file nuovi, senza aspettare
      // il max-age=600 della HTTP cache (evita mix di moduli tra versioni).
      const res = await fetch(new Request(e.request, { cache: 'no-cache' }));
      if (res.ok) {
        const copy = res.clone();
        const c = await caches.open(CACHE_VERSION);
        c.put(e.request, copy);
      }
      return res;
    } catch (err) {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      if (cached) return cached;
      if (e.request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
