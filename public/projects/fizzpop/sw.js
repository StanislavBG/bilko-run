// FizzPop service worker — offline-play of the daily puzzle.
// Strategy: stale-while-revalidate for HTML/JS/CSS/assets (cache-first, then refresh).
// Scope is /projects/fizzpop/ via the registration call in src/sw-register.ts.
// Cache name is versioned so a new bundle invalidates the old cache.

const VERSION = 'fizzpop-v0.4.0';
const SCOPE = '/projects/fizzpop/';

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll([
        SCOPE,
        `${SCOPE}index.html`,
        `${SCOPE}manifest.webmanifest`,
        `${SCOPE}favicon.svg`,
        `${SCOPE}icon-192.png`,
        `${SCOPE}icon-512.png`,
      ]).catch(() => { /* ignore — some may 404 on first install */ }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION && k.startsWith('fizzpop-')).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evt) => {
  const req = evt.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle in-scope requests; let the host serve everything else.
  if (!url.pathname.startsWith(SCOPE)) return;
  // Network-first for the HTML entry so version bumps are picked up quickly.
  const isHtml = req.mode === 'navigate' || req.destination === 'document';
  if (isHtml) {
    evt.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((c) => c.put(req, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached ?? caches.match(`${SCOPE}index.html`))),
    );
    return;
  }
  // Stale-while-revalidate for assets
  evt.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
