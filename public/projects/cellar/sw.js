// Cellar service worker — minimal offline shell.
// Scope: /projects/cellar/  (set by location of this file + manifest).
// Strategy:
//   - install: pre-cache the app shell (index.html only).
//   - fetch: network-first for HTML, cache-first for hashed JS/CSS assets.
//   - never intercept cross-origin or POST/PUT.

const VERSION = 'cellar-v0.7.0';
const SHELL = [
  '/projects/cellar/',
  '/projects/cellar/index.html',
  '/projects/cellar/favicon.svg',
  '/projects/cellar/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/projects/cellar/')) return;

  // HTML: network-first, fall back to cache.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, clone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/projects/cellar/'))),
    );
    return;
  }

  // Hashed JS/CSS/PNG: cache-first.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, clone)).catch(() => {});
        }
        return resp;
      });
    }),
  );
});
