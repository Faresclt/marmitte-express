// ═══════════════════════════════════════════════════════════════
// Service Worker — La Marmite Express
// ═══════════════════════════════════════════════════════════════
// Refacto v65 suite à l'audit PWA. Changements clés :
//  - Pas de skipWaiting() au install → l'app prompte l'utilisateur d'abord
//    et envoie un message SKIP_WAITING quand validé (zéro encaissement perdu)
//  - HTML pages dans ASSETS + stale-while-revalidate → cold-boot offline OK
//  - Timeout 3s sur fetch HTML + fallback cache si 5xx (déploiement en cours)
//  - Origin check sur les messages (anti-injection)
const CACHE_NAME = 'marmite-v71-xss-fixes-qrcodes-setup-images-migrate-admin-pages';

// HTML pages CRITIQUES — cachées au install pour cold-boot offline.
// Sans ça : tablette qui ouvre la caisse en wifi down matin = écran blanc.
const HTML_ASSETS = [
  './index.html',
  './marmite-express-caisse.html',
  './client.html',
  './cuisine.html',
  './serveur.html'
];

const STATIC_ASSETS = [
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
  './assets/js/sw-register.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
];

const ASSETS = HTML_ASSETS.concat(STATIC_ASSETS);

// Install — cache static assets + HTML pages critiques.
// PAS de skipWaiting() : on attend que l'app envoie SKIP_WAITING après prompt user.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // addAll est atomique : si UN asset rate, tout l'install rate.
      // Pour les HTML cross-page on tolère l'échec individuel.
      Promise.all(ASSETS.map(url =>
        cache.add(url).catch(err => {
          console.warn('[SW] Skip cache (asset missing):', url, err.message);
        })
      ))
    )
  );
});

// Listen SKIP_WAITING depuis l'app (déclenché par bouton "Recharger" dans le banner)
self.addEventListener('message', event => {
  // Audit PWA #11 : origin check anti-injection iframe/extension
  if (event.origin && event.origin !== self.location.origin) return;
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate — clean old caches puis prend les contrôles via clients.claim()
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
    // Pas de postMessage SW_UPDATED ici : l'app détecte via
    // navigator.serviceWorker.addEventListener('controllerchange', ...)
  );
});

// Helper : Promise.race avec timeout. Évite que l'user attende 30s sur 2G.
function timedFetch(request, ms){
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Fetch strategy
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

  const isHTML = event.request.mode === 'navigate' ||
                 (event.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Audit PWA #4/#9/#10 : stale-while-revalidate avec timeout + 5xx fallback.
    // Avant : network-only. Conséquences :
    //   - 5xx (déploiement Netlify) → user voit page d'erreur au lieu du cache
    //   - 2G dégradé → 30s d'attente avant fallback
    //   - First visit offline → écran blanc (HTML pas pré-cachés)
    // Maintenant : cache d'abord (instant), puis revalidation réseau en arrière-plan.
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = timedFetch(event.request, 3000)
          .then(response => {
            // 5xx = traiter comme offline (fallback cache déjà servi)
            if (!response || (response.status >= 500 && response.status < 600)) {
              throw new Error('HTTP ' + (response && response.status));
            }
            // Met à jour le cache pour la prochaine visite
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
            return response;
          })
          .catch(err => {
            // Réseau down OU 5xx OU timeout → on a déjà servi le cache (si dispo)
            // ou on retourne le cache en fallback
            return cached || caches.match('./index.html');
          });

        // Cache-first si dispo, sinon attend le réseau
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Assets statiques (CSS/JS/images) : cache-first avec revalidation en background
  // Plus rapide en service que network-first (zéro bandwidth pour assets déjà cachés).
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(response => {
          // response.type === 'basic' filtre les opaque (CDN cross-origin sans CORS)
          // — on évite de poison le cache avec une opaque sans content valide.
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // si network fail, on a déjà servi cached

      return cached || fetchPromise;
    })
  );
});
