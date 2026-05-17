/* ============================================================
   pwa-standalone-detect.js
   Détecte si l'app tourne en PWA standalone (ajoutée à l'écran d'accueil)
   et applique une classe `pwa-standalone` sur <html>.

   Plus fiable que @media (display-mode: standalone) qui peut ne pas
   firer correctement sur iOS Safari. Permet aux règles CSS d'utiliser
   .pwa-standalone .selector au lieu de la media query.
   ============================================================ */
(function() {
  'use strict';

  function isStandalone() {
    // iOS Safari : navigator.standalone === true
    // Android Chrome : matchMedia('(display-mode: standalone)')
    // PWA installée : matchMedia('(display-mode: standalone)')
    var iosStandalone = window.navigator && window.navigator.standalone === true;
    var mediaStandalone = window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches;
    var mediaFullscreen = window.matchMedia &&
      window.matchMedia('(display-mode: fullscreen)').matches;
    var mediaMinimal = window.matchMedia &&
      window.matchMedia('(display-mode: minimal-ui)').matches;
    return iosStandalone || mediaStandalone || mediaFullscreen || mediaMinimal;
  }

  function apply() {
    var html = document.documentElement;
    if (isStandalone()) {
      html.classList.add('pwa-standalone');
    } else {
      html.classList.remove('pwa-standalone');
    }
  }

  apply();

  // Re-test si l'utilisateur installe/désinstalle la PWA pendant la session
  if (window.matchMedia) {
    var mq = window.matchMedia('(display-mode: standalone)');
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }

  window.__isPWAStandalone = isStandalone;
})();
