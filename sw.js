const CACHE_NAME = 'marmite-v3';
const ASSETS = [
  './index.html',
  './marmite-express-caisse.html',
  './client.html',
  './serveur.html',
  './cuisine.html',
  './qrcodes.html',
  './setup-images.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
];

// Install — cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip Firebase, Gemini AI, and external API requests
  if(event.request.url.includes('firestore') ||
     event.request.url.includes('firebase') ||
     event.request.url.includes('gstatic.com/firebasejs') ||
     event.request.url.includes('generativelanguage.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if(response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
