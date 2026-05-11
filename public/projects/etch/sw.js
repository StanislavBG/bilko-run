/* Etch service worker — minimal offline cache, strictly scoped to /projects/etch/.
 *
 * Strategy: cache-first for already-loaded same-origin assets under the scope.
 * Network-first for the daily JSON so users get today's puzzle when online.
 *
 * IMPORTANT: bumping CACHE_NAME invalidates the prior cache on activate.
 */
const CACHE_NAME = 'etch-v0.4.0';
const SCOPE = self.registration.scope; // ends with /projects/etch/

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately on update.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        SCOPE,
        SCOPE + 'index.html',
        SCOPE + 'manifest.webmanifest',
      ]).catch(() => undefined),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin requests under our scope.
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/projects/etch/')) return;

  // Daily JSON: network-first; fall back to cache when offline.
  if (url.pathname.includes('/daily/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || Response.error())),
    );
    return;
  }

  // Everything else: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, basic responses.
        if (!res || !res.ok || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => cached || Response.error());
    }),
  );
});
