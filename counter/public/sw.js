// Offline support. Online, every request goes to the network so a new version shows up straight away;
// with no signal (or none within 3 seconds), the last saved copy is served instead.
const CACHE = 'counter-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/cdn-cgi/')) return;
  // Every page load is the one app page, whatever the query string.
  const key = req.mode === 'navigate' ? '/' : req;
  const network = fetch(req).then((res) => {
    // A redirected response can't answer a navigation, so don't keep one.
    if (res.ok && !res.redirected) {
      const copy = res.clone();
      return caches.open(CACHE).then((c) => c.put(key, copy)).then(() => res);
    }
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  e.respondWith(caches.match(key).then((cached) => {
    if (!cached) return network;
    const slow = new Promise((resolve) => setTimeout(() => resolve(cached), 3000));
    return Promise.race([network.catch(() => cached), slow]);
  }));
});
