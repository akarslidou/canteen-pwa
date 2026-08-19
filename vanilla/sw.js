const CACHE_NAME = 'mensa-static-v1'; // Local assets
const API_CACHE_NAME = 'mensa-api-v1'; //Cache for Mensa API

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

// Precache static assets and activate immediately
self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become active
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching core assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME, API_CACHE_NAME]; 
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (!cacheWhitelist.includes(key)) {
            console.log('Service Worker: Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept network requests
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Strategie 1: Network-First (Für OpenMensa API)
  // Tipp: Prlocation/Hostname flexibler prüfen (falls du lokal oder über Proxies testest)
  if (requestUrl.hostname.includes('openmensa.org') || requestUrl.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Nur erfolgreiche Antworten (HTTP 200-299) cachen
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline-Fallback: Versuche Daten aus dem Cache zu holen
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Falls für diesen Tag noch NICHTS im Cache liegt: Sauberen 503-HTTP-Error zurückgeben
          return new Response(
            JSON.stringify({ error: "Offline und keine Daten im Cache vorhanden" }), 
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
  } 
  // Strategie 2: Cache-First (Für lokale statische Dateien)
  else {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});