/* SendJet PWA Service Worker
 * Strategy:
 *  - Same-origin static assets (JS/CSS/img/font): cache-first with background revalidation
 *  - HTML navigations (SPA shell): network-first, fall back to cached shell when offline
 *  - API requests (/api/*): network-only (do not cache responses to avoid stale auth/listings)
 *  - Bump CACHE_VERSION on each meaningful release so old caches purge.
 */
const CACHE_VERSION = 'sendjet-pwa-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sendjet-logo.png',
  '/sendjet-wordmark.png',
  '/favicon-256.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // only handle GETs

  const url = new URL(req.url);

  // 1. API calls — bypass cache entirely
  if (url.pathname.startsWith('/api/')) {
    return; // let the browser handle it
  }

  // 2. Cross-origin (Unsplash, fonts, etc.) — let browser handle, optionally cache successful images
  if (url.origin !== self.location.origin) {
    if (req.destination === 'image' || req.destination === 'font') {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  // 3. Same-origin navigations (HTML page loads)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // 4. Same-origin static asset — cache-first
  event.respondWith(staleWhileRevalidate(req));
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE_VERSION).then((cache) =>
    cache.match(req).then((cached) => {
      const networkPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type !== 'opaqueredirect') {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })
  );
}

// Allow the app to nudge the SW to take control immediately after a release.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
