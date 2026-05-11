/* Etch service worker — minimal offline cache, strictly scoped to /projects/etch/.
 *
 * Strategy: cache-first for already-loaded same-origin assets under the scope.
 * Network-first for the daily JSON so users get today's puzzle when online.
 *
 * v0.7.0: install-time prefetch of tomorrow's daily JSON when connection is
 * fast (effectiveType === '4g', no saveData). Saves a round-trip on the next
 * puzzle the player loads.
 *
 * IMPORTANT: bumping CACHE_NAME invalidates the prior cache on activate.
 */
const CACHE_NAME = 'etch-v0.7.0';
const SCOPE = self.registration.scope; // ends with /projects/etch/

function networkOk() {
  try {
    const conn = self.navigator && self.navigator.connection;
    if (!conn) return true;
    if (conn.saveData === true) return false;
    if (typeof conn.effectiveType === 'string' && conn.effectiveType !== '4g') return false;
    return true;
  } catch (_e) {
    return true;
  }
}

function tomorrowIso() {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately on update.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Core shell — always prefetch.
      await cache.addAll([
        SCOPE,
        SCOPE + 'index.html',
        SCOPE + 'manifest.webmanifest',
      ]).catch(() => undefined);
      // Tomorrow's daily — only on fast networks. Best-effort; failures are
      // silent so the worker still installs cleanly when offline.
      if (networkOk()) {
        const url = SCOPE + 'daily/' + tomorrowIso() + '.json';
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          if (res.ok) await cache.put(url, res.clone());
        } catch (_e) { /* offline or 404; ignore */ }
      }
    }),
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
