const CACHE = 'startup-io-v6-original-city';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('./index.html', { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    await cache.put('./index.html', response.clone());
    const html = await response.text();
    const files = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"\s]+)"/g)].map(match => match[1]);
    await cache.addAll(['./icon.svg', './manifest.webmanifest', ...files]);
    // Cache the lazy engine dependency too, so the game can start on an offline reload.
    const dependencies = new Set();
    for (const file of files.filter(file => file.endsWith('.js'))) {
      const source = await (await cache.match(file)).text();
      for (const match of source.matchAll(/["'](?:\.\/|assets\/)?([A-Za-z0-9_-]+\.(?:js|woff2?))["']/g)) dependencies.add(`./assets/${match[1]}`);
    }
    if (dependencies.size) await cache.addAll([...dependencies]);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key.startsWith('startup-io-')) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); } catch { return await caches.match('./index.html'); }
    }
    const saved = await caches.match(event.request);
    if (saved) return saved;
    const response = await fetch(event.request);
    if (response.ok) { const cache = await caches.open(CACHE); await cache.put(event.request, response.clone()); }
    return response;
  })());
});
