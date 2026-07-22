/* Coffee Kingdom Rewards — service worker (network-first, offline fallback) */
const CACHE = 'ck-rewards-v2';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never touch API or auth/payment calls — always hit the network.
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase') || url.hostname.includes('square')) {
    return;
  }
  if (e.request.method !== 'GET') return;

  // Network-first: always try to load the freshest asset when online (so deploys
  // land immediately), and fall back to the cached copy only when offline.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
