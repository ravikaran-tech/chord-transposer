/* =========================================================
   LWP CHORD TRANSPOSER — PRODUCTION OFFLINE SERVICE WORKER
   Safe for Netlify + Mobile Home-Screen PWA
========================================================= */

const CACHE_NAME = "lwp-transposer-v1";

/* Core files required for full offline functionality */
const STATIC_ASSETS = [
  "/",                // root
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];


/* =========================================================
   INSTALL — cache core assets
========================================================= */
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});


/* =========================================================
   ACTIVATE — remove old caches
========================================================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});


/* =========================================================
   FETCH — offline-first strategy
========================================================= */
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return cached file if available, otherwise fetch from network
      return cachedResponse || fetch(event.request);
    })
  );
});