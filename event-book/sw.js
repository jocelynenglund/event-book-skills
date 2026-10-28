// EventPad service worker: lets the app install, and open offline.
// Network first, so a deploy is picked up straight away; the cache is only
// the fallback when there's no connection. Models live in IndexedDB anyway.

const CACHE = 'eventpad-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  // Only our own files; the share API and fonts go straight to the network
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    } catch (err) {
      const cached = await caches.match(req) || await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') return (await caches.match('./')) || (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});
