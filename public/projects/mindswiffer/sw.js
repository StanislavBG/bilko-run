/* MindSwiffer service worker — offline-first cache for static-path drop.
 *
 * Strategy:
 *  - Precaches the document shell + manifest on install.
 *  - Runtime cache uses stale-while-revalidate for /projects/mindswiffer/ assets
 *    (everything fingerprinted under /assets/ is immutable; this still serves a
 *    fast offline experience on second load).
 *  - Scope is the static-path mount point so the SW only owns its own folder
 *    (host contract — we never touch the host app's routes).
 */

const VERSION = 'mindswiffer-v0.7.0';
const PREFIX = '/projects/mindswiffer/';
const SHELL = [
  PREFIX,
  `${PREFIX}index.html`,
  `${PREFIX}manifest.webmanifest`,
  `${PREFIX}favicon.svg`,
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Catch shell failures individually so a 404 doesn't block install.
    await Promise.all(SHELL.map((u) => cache.add(u).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.pathname.startsWith(PREFIX)) return; // strictly scoped
  if (url.pathname.startsWith(`${PREFIX}sw.js`)) return; // never cache ourselves

  // Stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const networked = fetch(req).then((res) => {
      if (res.ok && res.type !== 'opaque') void cache.put(req, res.clone()).catch(() => undefined);
      return res;
    }).catch(() => cached ?? new Response('Offline', { status: 503, statusText: 'Offline' }));
    return cached ?? networked;
  })());
});
