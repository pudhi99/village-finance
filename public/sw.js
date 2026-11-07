/**
 * Service Worker — Village Finance (Module 09 PWA & Offline Engine)
 *
 * Implements:
 * 1. Resilient pre-caching of PWA icons and web manifest.
 * 2. Network-first strategy for navigation and static assets with offline fallback.
 * 3. Strict bypass of mutations, Next.js Server Actions, and RSC Flight payloads.
 */

const CACHE_NAME = 'vf-cache-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Pre-cache skipped:', asset, err);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept non-GET requests, Next.js server actions, or RSC Flight payloads
  if (
    req.method !== 'GET' ||
    req.headers.has('next-action') ||
    req.headers.has('rsc') ||
    req.url.includes('_rsc=')
  ) {
    return;
  }

  // Network-first with cache fallback for offline resilience
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Cache successful basic responses
        if (networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (req.mode === 'navigate') {
          return (
            (await caches.match('/')) ||
            new Response(
              `<!DOCTYPE html>
              <html lang="en">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>Offline — Village Finance</title>
                  <style>
                    body { background: #020617; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: #0f172a; border: 1px solid #1e293b; padding: 2rem; border-radius: 1rem; max-width: 400px; margin: 1rem; }
                    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; color: #38bdf8; }
                    p { font-size: 0.875rem; color: #94a3b8; line-height: 1.5; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>You Are Offline</h1>
                    <p>Village Finance is running without an active internet connection. Your saved line routes, customers, and pending repayments are stored safely on your device.</p>
                  </div>
                </body>
              </html>`,
              {
                headers: { 'Content-Type': 'text/html' },
              }
            )
          );
        }
        return new Response('Offline: Network unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});
