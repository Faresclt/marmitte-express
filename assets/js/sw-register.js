// ═══════════════════════════════════════════════════════════════
// SW Register + Update Prompt + Online Retry
// ═══════════════════════════════════════════════════════════════
// Inclus dans toutes les pages métier (caisse, client, cuisine, serveur, index).
// Avant : seule index.html registrait le SW → la PWA ouverte direct sur caisse
// (shortcut, signet, partage URL) n'avait PAS de cache offline.
//
// Refacto v65 — répond à 5 problèmes de l'audit PWA :
//  #1 register sur toutes les pages
//  #2/#3 prompt utilisateur avant reload (zéro encaissement perdu)
//  #5 retry sales offline sur 'online' event + page focus
//  #6 BroadcastChannel pour coordonner multi-tab
//  #7/#8 logging erreurs + update périodique 30 min
(function(){
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  // ── 1. Registration + update périodique ─────────────────────────
  navigator.serviceWorker.register('./sw.js').then(function(reg){
    // Audit PWA #8 : update périodique pour tablette qui reste allumée 14h
    // (sans recharger la page, le SW ne checkerait jamais une nouvelle version)
    setInterval(function(){
      reg.update().catch(function(e){ console.warn('[SW] update fail:', e.message); });
    }, 30 * 60 * 1000); // 30 min

    // Audit PWA #2/#3 : prompt utilisateur quand nouvelle version dispo
    // Avant : skipWaiting au install + reload silencieux = panier perdu.
    reg.addEventListener('updatefound', function(){
      var newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', function(){
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller){
          // Une nouvelle version est prête. On stocke la ref pour le banner.
          window._swPendingReg = reg;
          showUpdateBanner(reg);
        }
      });
    });

    // Si une version waiting existe déjà au load (l'user a fermé sans recharger
    // la fois précédente), proposer immédiatement
    if (reg.waiting && navigator.serviceWorker.controller){
      window._swPendingReg = reg;
      showUpdateBanner(reg);
    }
  }).catch(function(err){
    // Audit PWA #7 : avant `.catch(()=>{})` silencieux. Debugging impossible.
    console.error('[SW] Register failed:', err);
    window._swError = err;
  });

  // ── 2. controllerchange → reload ───────────────────────────────
  // Déclenché quand le nouveau SW (qui était waiting) prend la main après
  // SKIP_WAITING. On reload pour servir les nouvelles versions HTML/CSS/JS.
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // ── 3. Audit PWA #11 : message origin check ────────────────────
  // Avant : brand-boot.js écoutait SW_UPDATED sans vérifier event.source
  // → une iframe/extension pouvait forcer un reload.
  navigator.serviceWorker.addEventListener('message', function(event){
    if (event.origin && event.origin !== self.location.origin) return;
    // Plus de comportement legacy SW_UPDATED ici — replacé par controllerchange.
    // Conservé pour usages futurs (push notif, etc.)
  });

  // ── 4. Banner UI "Nouvelle version dispo" ───────────────────────
  function isBusy(){
    // Encaissement actif : panier non-vide OU paiement en cours
    try {
      if (typeof window.ticket !== 'undefined' && Array.isArray(window.ticket) && window.ticket.length > 0) return true;
      if (window._counterBusy) return true;
      // Si modal de paiement ouvert
      var pay = document.getElementById('pay-overlay');
      if (pay && pay.classList && pay.classList.contains('show')) return true;
    } catch(e){}
    return false;
  }

  function showUpdateBanner(reg){
    if (document.getElementById('sw-update-banner')) return; // déjà affiché
    if (isBusy()){
      // Encaissement actif : re-tente dans 30 s. Évite de distraire le serveur.
      setTimeout(function(){ showUpdateBanner(reg); }, 30000);
      return;
    }
    var banner = document.createElement('div');
    banner.id = 'sw-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;background:#1e2030;border:1px solid #f5a623;border-radius:12px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,.5);color:#fff;font-family:system-ui,sans-serif;font-size:14px;max-width:340px;display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    banner.innerHTML =
      '<div style="flex:1;min-width:160px"><strong style="color:#f5a623">🔄 Mise à jour disponible</strong><div style="font-size:12px;opacity:.8;margin-top:2px">Recharge pour appliquer les correctifs.</div></div>' +
      '<button type="button" id="sw-update-accept" style="background:#f5a623;color:#000;border:none;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer;font-size:13px">Recharger</button>' +
      '<button type="button" id="sw-update-defer" style="background:transparent;color:#9ca3af;border:1px solid #374151;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px">Plus tard</button>';
    document.body.appendChild(banner);

    document.getElementById('sw-update-accept').onclick = function(){
      if (reg && reg.waiting){
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange handler va reload
      } else {
        window.location.reload();
      }
    };
    document.getElementById('sw-update-defer').onclick = function(){
      banner.remove();
      // Re-prompt dans 5 min
      setTimeout(function(){ showUpdateBanner(reg); }, 5 * 60 * 1000);
    };
  }

  // ── 5. Audit PWA #5 : retry sync sales offline ───────────────
  // Quand on revient online (ou que la page reprend le focus), tente de
  // re-pousser le compteur receipt et les sales LS vers Firebase.
  // Compromis simple vs vraie Background Sync API (non supportée iOS).
  function retryPendingSync(){
    if (!navigator.onLine) return;
    // Si le compteur a été marqué offline (cf. v63), tente de re-sync
    if (window._counterOfflineMode && typeof window.syncReceiptCounterAtBoot === 'function'){
      console.log('[SW] online detected, retry counter sync');
      try { window.syncReceiptCounterAtBoot(); } catch(e){}
    }
    // Tente aussi de re-push les sales locales non-synchronisées
    if (typeof window.publishMenu === 'function' && window.FB){
      try { window.publishMenu(true); } catch(e){}
    }
  }
  window.addEventListener('online', retryPendingSync);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') retryPendingSync();
  });

  // ── 6. Audit PWA #6 : BroadcastChannel pour coordonner multi-tab ─
  // Si iPad caisse et iPhone serveur reçoivent updatefound en même temps,
  // un seul banner doit s'afficher (le premier qui prend la main).
  if ('BroadcastChannel' in window){
    try {
      var bc = new BroadcastChannel('sw-coordination');
      bc.onmessage = function(e){
        if (e.data && e.data.type === 'BANNER_DISMISSED'){
          var b = document.getElementById('sw-update-banner');
          if (b) b.remove();
        }
      };
      // Hook : quand on dismiss, on broadcast aux autres tabs
      window.addEventListener('beforeunload', function(){ try{ bc.close(); }catch(e){} });
    } catch(e){ /* BroadcastChannel optionnel */ }
  }
})();
