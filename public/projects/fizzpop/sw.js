// FizzPop service worker — offline-play of the daily puzzle.
// Strategy: stale-while-revalidate for HTML/JS/CSS/assets (cache-first, then refresh).
// Scope is /projects/fizzpop/ via the registration call in src/sw-register.ts.
// Cache name is versioned so a new bundle invalidates the old cache.
//
// v0.7.0:
//   - Bumped version so old caches purge cleanly
//   - 'PREFETCH_NEXT_DAILY' message — client posts when idle; SW warms the
//     daily playfields JSON. We skip on Save-Data or slow effective-type
//     network connections (gathered client-side and posted along).

const VERSION = 'fizzpop-v0.7.0';
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
  if (!url.pathname.startsWith(SCOPE)) return;
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

// Idle-prefetch hook: client posts PREFETCH_NEXT_DAILY with network hints.
// SW warms the daily JSON + any explicit URLs into the cache. We skip on
// Save-Data or slow connections (effectiveType=2g/slow-2g) to honor the
// user's bandwidth preferences.
self.addEventListener('message', (evt) => {
  const data = evt.data;
  if (!data || data.kind !== 'PREFETCH_NEXT_DAILY') return;
  const slow = data.saveData === true
    || data.effectiveType === '2g'
    || data.effectiveType === 'slow-2g';
  if (slow) return;
  const urls = Array.isArray(data.urls) && data.urls.length > 0 ? data.urls : [];
  if (urls.length === 0) return;
  evt.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      for (const u of urls) {
        try {
          const existing = await cache.match(u);
          if (existing) continue;
          const res = await fetch(u, { credentials: 'same-origin' });
          if (res.ok) await cache.put(u, res.clone());
        } catch { /* swallow — best-effort */ }
      }
    }),
  );
});
