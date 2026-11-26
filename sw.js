const CACHE_NAME = 'nexus-web-shell-v29';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './drawing-studio.css',
  './app.js',
  './nexus-controls.js',
  './worker.js',
  './spreadsheet-engine.js',
  './manifest.webmanifest',
  './nexus-icon.svg'
];
const APP_SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.location.href).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('nexus-browser-shell-') || key.startsWith('nexus-web-shell-')) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !APP_SHELL_URLS.has(url.href)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const offlinePage = await caches.match(new URL('./index.html', self.location.href).href);
        if (offlinePage) return offlinePage;
      }
      return Response.error();
    }
  })());
});

