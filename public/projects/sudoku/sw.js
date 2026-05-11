/* Bilko-Sudoku service worker.
 *
 * Scope: /projects/sudoku/ (enforced by the manifest scope + register path).
 *
 * Strategy:
 *   • Precache the app shell on install (index.html, favicon, icons,
 *     manifest).
 *   • Runtime: stale-while-revalidate for same-origin assets under our
 *     scope. Network-first for the document so users get updated builds.
 *   • Never intercept analytics, telemetry, or cross-origin requests.
 *   • Listen for a `prefetch-assets` message from the client and warm
 *     the lazy chunk URLs it sends, but ONLY when the client says the
 *     connection is fast (effectiveType === '4g'). This keeps the
 *     secondary chunks (StatsSheet, HelpCenter, ReplayViewer) hot for
 *     the first interaction after FCP without burning data on 2G/3G.
 */

const SW_VERSION = 'sudoku-v2';
const CACHE_NAME = `bilko-sudoku-${SW_VERSION}`;
const SCOPE = '/projects/sudoku/';

const PRECACHE = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'favicon.svg',
  SCOPE + 'icon-192.png',
  SCOPE + 'icon-512.png',
  SCOPE + 'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: 'reload' })
            .then((r) => r.ok && cache.put(url, r.clone()))
            .catch(() => undefined),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('bilko-sudoku-') && k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE)) return;

  // Network-first for HTML so users pick up new builds.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
          return r;
        })
        .catch(() => caches.match(req).then((c) => c ?? caches.match(SCOPE) ?? caches.match(SCOPE + 'index.html'))),
    );
    return;
  }

  // Stale-while-revalidate for everything else under scope.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return r;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    }),
  );
});

/**
 * Idle-time asset prefetch. The client posts a list of lazy-chunk URLs
 * (StatsSheet, HelpCenter, ReplayViewer, WinModal) once after FCP. We
 * only honour the request if the client tells us the connection is fast.
 * Each URL is fetched at low priority and dropped into the same cache as
 * runtime requests, so subsequent first-tap navigation hits the cache.
 */
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.type !== 'prefetch-assets') return;
  if (msg.effectiveType && msg.effectiveType !== '4g') return;
  const urls = Array.isArray(msg.urls) ? msg.urls : [];
  if (urls.length === 0) return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urls.map((u) =>
          fetch(u, { credentials: 'same-origin', priority: 'low' })
            .then((r) => r.ok && cache.put(u, r.clone()))
            .catch(() => undefined),
        ),
      ),
    ),
  );
});
