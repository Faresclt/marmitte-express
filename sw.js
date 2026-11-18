// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Service Worker â€” La Marmite Express
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Refacto v65 suite Ã  l'audit PWA. Changements clÃ©s :
//  - Pas de skipWaiting() au install â†’ l'app prompte l'utilisateur d'abord
//    et envoie un message SKIP_WAITING quand validÃ© (zÃ©ro encaissement perdu)
//  - HTML pages dans ASSETS + stale-while-revalidate â†’ cold-boot offline OK
//  - Timeout 3s sur fetch HTML + fallback cache si 5xx (dÃ©ploiement en cours)
//  - Origin check sur les messages (anti-injection)
//  v80 (2026-11-18) : cache VERSIONNÃ‰ cohÃ©rent â€” les fichiers de l'app
//  (ASSETS) ne sont remplis qu'Ã  l'installation de la version, en
//  contournant le cache HTTP ({cache:'reload'}). Plus de mÃ©lange
//  Â« HTML neuf + JS ancien Â» par revalidation en arriÃ¨re-plan : une nouvelle
//  version arrive en bloc via le bandeau de mise Ã  jour.
const CACHE_NAME = 'marmite-v82-photos';

// HTML pages CRITIQUES â€” cachÃ©es au install pour cold-boot offline.
// Sans Ã§a : tablette qui ouvre la caisse en wifi down matin = Ã©cran blanc.
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
  './assets/js/carte-2026.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
];

const ASSETS = HTML_ASSETS.concat(STATIC_ASSETS);

// Install â€” cache static assets + HTML pages critiques.
// PAS de skipWaiting() : on attend que l'app envoie SKIP_WAITING aprÃ¨s prompt user.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // addAll est atomique : si UN asset rate, tout l'install rate.
      // Pour les HTML cross-page on tolÃ¨re l'Ã©chec individuel.
      Promise.all(ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(err => {
          console.warn('[SW] Skip cache (asset missing):', url, err.message);
        })
      ))
    )
  );
});

// Listen SKIP_WAITING depuis l'app (dÃ©clenchÃ© par bouton "Recharger" dans le banner)
self.addEventListener('message', event => {
  // Audit PWA #11 : origin check anti-injection iframe/extension
  if (event.origin && event.origin !== self.location.origin) return;
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate â€” clean old caches puis prend les contrÃ´les via clients.claim()
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
    // Pas de postMessage SW_UPDATED ici : l'app dÃ©tecte via
    // navigator.serviceWorker.addEventListener('controllerchange', ...)
  );
});

// Helper : Promise.race avec timeout. Ã‰vite que l'user attende 30s sur 2G.
function timedFetch(request, ms){
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Fichiers de l'app (chemins absolus) : servis depuis le cache de LEUR version.
const APP_PATHS = new Set(ASSETS.filter(u => u.startsWith('./')).map(u => new URL(u, self.location.href).pathname));

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;

  // Fichier de l'app prÃ©cachÃ© â†’ cache de la version installÃ©e (cohÃ©rent),
  // rÃ©seau seulement s'il manque. Pas de rÃ©Ã©criture en arriÃ¨re-plan.
  try {
    const u = new URL(url);
    if (u.origin === self.location.origin && APP_PATHS.has(u.pathname)) {
      event.respondWith(
        caches.open(CACHE_NAME).then(c => c.match(u.pathname, { ignoreSearch: true }).then(hit =>
          hit || fetch(event.request).then(r => {
            if (r && r.ok && r.type === 'basic') { const cl = r.clone(); c.put(u.pathname, cl); }
            return r;
          }).catch(() => c.match('./index.html'))
        ))
      );
      return;
    }
  } catch (e) {}

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
    // Avant : network-only. ConsÃ©quences :
    //   - 5xx (dÃ©ploiement Netlify) â†’ user voit page d'erreur au lieu du cache
    //   - 2G dÃ©gradÃ© â†’ 30s d'attente avant fallback
    //   - First visit offline â†’ Ã©cran blanc (HTML pas prÃ©-cachÃ©s)
    // Maintenant : cache d'abord (instant), puis revalidation rÃ©seau en arriÃ¨re-plan.
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = timedFetch(event.request, 3000)
          .then(response => {
            // 5xx = traiter comme offline (fallback cache dÃ©jÃ  servi)
            if (!response || (response.status >= 500 && response.status < 600)) {
              throw new Error('HTTP ' + (response && response.status));
            }
            // Met Ã  jour le cache pour la prochaine visite
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
            return response;
          })
          .catch(err => {
            // RÃ©seau down OU 5xx OU timeout â†’ on a dÃ©jÃ  servi le cache (si dispo)
            // ou on retourne le cache en fallback
            return cached || caches.match('./index.html');
          });

        // Cache-first si dispo, sinon attend le rÃ©seau
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Assets statiques (CSS/JS/images) : cache-first avec revalidation en background
  // Plus rapide en service que network-first (zÃ©ro bandwidth pour assets dÃ©jÃ  cachÃ©s).
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(response => {
          // response.type === 'basic' filtre les opaque (CDN cross-origin sans CORS)
          // â€” on Ã©vite de poison le cache avec une opaque sans content valide.
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // si network fail, on a dÃ©jÃ  servi cached

      return cached || fetchPromise;
    })
  );
});
