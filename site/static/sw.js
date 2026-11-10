// Service worker : l'application complète est mise en cache pour s'ouvrir sans réseau (les données sont dans le navigateur).
// Réseau d'abord (toujours à jour quand on est en ligne), cache en secours ; les promos chiffrées suivent la même règle.
const BUILD = '__BUILD__';
const CACHE = `omq-${BUILD}`;
const SHELL = ['./', 'index.html', 'app.js?v=' + BUILD, 'styles.css?v=' + BUILD, 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('omq-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match(e.request, { ignoreSearch: false })) || (await cache.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? cache.match('index.html') : Response.error());
    }
  })());
});
