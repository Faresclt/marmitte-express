const CACHE_NAME = 'marmite-v63-stats-nf525-pin-counter-csv-timezone-merge';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/css/design-system.css',
  './assets/css/components.css',
  './assets/css/caisse.css',
  './assets/js/brand-boot.js',
  './assets/js/sync-banner.js',
  './assets/js/tap-feedback.js',
  './assets/js/theme.js',
  './assets/js/orders-rest-poll.js',
  './assets/js/pwa-standalone-detect.js',
  './assets/js/firebase-sync.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
];

// Install — cache static assets only (NOT HTML pages, on les veut toujours frais)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches + take over all open tabs immédiatement
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Notifie toutes les pages ouvertes qu'un nouveau SW est actif
        // → elles vont se reload pour avoir le HTML frais
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', cache: CACHE_NAME }));
        });
      })
  );
});

// Fetch strategy — différent selon le type de ressource
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Skip Firebase / fonts dynamiques / APIs externes
  if (url.includes('firestore') ||
      url.includes('firebase') ||
      url.includes('gstatic.com/firebasejs') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('pollinations.ai') ||
      url.includes('recraft.ai')) {
    return;
  }

  // HTML pages : network-only (avec cache fallback uniquement si offline)
  // → Garantit que l'utilisateur a toujours le HTML le plus récent
  const isHTML = event.request.mode === 'navigate' ||
                 (event.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Pas de cache pour le HTML — on veut toujours frais
          return response;
        })
        .catch(() => {
          // Offline → on tente le cache en dernier recours
          return caches.match(event.request)
            .then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // Assets statiques (CSS/JS/images) : network-first avec cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
