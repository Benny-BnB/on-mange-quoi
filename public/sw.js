// Service worker : l'application complète (écrans, moteur de recettes) est mise en cache pour fonctionner sans réseau.
// Les données, elles, vivent dans le navigateur et se synchronisent au retour du réseau.
const BUILD = '__BUILD__';
const CACHE = `omqcs-${BUILD}`;
const SHELL = ['/', '/index.html', '/styles.css', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // modules JS : liste fournie par le serveur
    try {
      const list = await (await fetch('/api/assets', { cache: 'no-store' })).json();
      await cache.addAll(list);
    } catch { /* hors ligne à l'installation : le cache se remplira à l'usage */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('omqcs-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    // réseau d'abord (toujours à jour quand on est en ligne), cache en secours
    try {
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      return hit || (e.request.mode === 'navigate' ? cache.match('/index.html') : Response.error());
    }
  })());
});
