/* ============================================================
   sync-banner.js — Affiche un bandeau global lorsque le réseau
   passe offline / revient online.

   Utilise les classes définies dans design-system.css :
     .sync-banner / .visible / .offline / .online / .pending

   API publique :
     window.SyncBanner.show(state, msg)  // state: offline|online|pending
     window.SyncBanner.hide()
   ============================================================ */
(function() {
  'use strict';

  var banner = null;
  var hideTimer = null;

  function ensureBanner() {
    if (banner) return banner;
    banner = document.getElementById('sync-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'sync-banner';
      banner.className = 'sync-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      document.body.appendChild(banner);
    }
    return banner;
  }

  function show(state, msg) {
    var b = ensureBanner();
    b.className = 'sync-banner visible ' + (state || 'offline');
    b.textContent = msg || defaultMsg(state);
    clearTimeout(hideTimer);
    if (state === 'online') {
      // Auto-hide après 2s pour le retour en ligne
      hideTimer = setTimeout(hide, 2000);
    }
  }

  function hide() {
    if (banner) banner.className = 'sync-banner';
  }

  function defaultMsg(state) {
    if (state === 'offline') return '⚠ Hors ligne — vos données sont enregistrées localement';
    if (state === 'online')  return '✓ Connexion rétablie';
    if (state === 'pending') return '⏳ Synchronisation en cours…';
    return '';
  }

  window.SyncBanner = { show: show, hide: hide };

  // Auto-bind aux events réseau du navigateur
  function init() {
    if (!navigator.onLine) {
      show('offline');
    }
    window.addEventListener('online',  function() { show('online'); });
    window.addEventListener('offline', function() { show('offline'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
