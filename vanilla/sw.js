const CACHE_NAME = 'mensa-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  
  // UI & Category assets
  './images/icon_fisch.png.webp',
  './images/icon_gefluegel.png.webp',
  './images/icon_kalb.png.webp',
  './images/icon_lamm.png.webp',
  './images/icon_rind.png.webp',
  './images/icon_schwein.png.webp',
  './images/icon_wild.png.webp',
  './images/icon_vegetarisch.png.webp',
  './images/icon_vegan.png.webp'
];

// Precache static assets on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching core assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Clean up outdated caches when a new service worker activates
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Serve cached assets if available, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request);
    })
  );
});