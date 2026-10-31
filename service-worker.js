// Bump CACHE_VERSION whenever you deploy changes so clients pick them up.
// Keep it equal to the ?v= number on every css/js link in index.html.
const CACHE_VERSION = 'v15';
const ASSET_V = CACHE_VERSION.slice(1);
const CACHE_NAME = `chord-transposer-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  `./style.css?v=${ASSET_V}`,
  `./app.js?v=${ASSET_V}`,
  `./guitar.js?v=${ASSET_V}`,
  `./guitar-chords.js?v=${ASSET_V}`,
  `./live-lookup.js?v=${ASSET_V}`,
  `./ui-enhance.js?v=${ASSET_V}`,
  `./upload.js?v=${ASSET_V}`,
  `./menu.js?v=${ASSET_V}`,
  `./song-clear.js?v=${ASSET_V}`,
  `./song-pdf.js?v=${ASSET_V}`,
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first for our own HTML/CSS/JS so fresh deploys always win,
// falling back to cache when offline. Other requests: cache-first.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isAppShell =
    req.destination === 'document' ||
    req.destination === 'style' ||
    req.destination === 'script';

  if (isAppShell) {
    event.respondWith(
      // no-cache: always re-check with the server, never a stale HTTP copy
      fetch(req, { cache: 'no-cache' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});
