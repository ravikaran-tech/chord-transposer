const CACHE_NAME = 'chord-transposer-runtime';

const STATIC_ASSETS = [
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  // DO NOT intercept HTML or CSS (this fixes raw HTML issue)
  if (
    event.request.destination === 'document' ||
    event.request.destination === 'style'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
