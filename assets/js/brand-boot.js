/* ============================================================
   brand-boot.js — Hydratation du branding depuis localStorage
   AVANT le retour de Firebase (évite le flash du logo par défaut).

   Usage : inclure SANS `defer` ni `async`, et AVANT la fin de body.
   Le script attend `DOMContentLoaded` si les éléments cibles ne sont
   pas encore dans le DOM.

   Clés localStorage utilisées :
     - brand_logoUrl
     - brand_name
     - brand_accent

   Sélecteurs DOM ciblés (tous optionnels) :
     - #brand-logo-img / #brand-logo-svg / #brand-logo-text
     - #resto-logo     / #resto-name
     - #resto-logo-img / #resto-name-cuisine
   ============================================================ */
(function() {
  'use strict';

  function read(key) {
    try {
      var v = localStorage.getItem(key);
      if (v == null) return null;
      // marmite-express-caisse.html stocke en JSON.stringify (avec guillemets) ;
      // notre listener stocke en raw string. On accepte les deux formats.
      if (v.length >= 2 && v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') {
        try { return JSON.parse(v); } catch (e) { /* fallthrough */ }
      }
      return v;
    } catch (e) { return null; }
  }

  function applyBrandToDom() {
    var cachedLogo   = read('brand_logoUrl');
    var cachedName   = read('brand_name');
    var cachedAccent = read('brand_accent');

    // ── Couleur d'accent ──────────────────────────────────────
    if (cachedAccent) {
      document.documentElement.style.setProperty('--accent', cachedAccent);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', cachedAccent);
    }

    // ── Logos (3 patterns possibles selon la page) ────────────
    var logoTargets = [
      { img: 'brand-logo-img',  svg: 'brand-logo-svg', display: 'block' },
      { img: 'resto-logo',      svg: null,              display: 'block' },
      { img: 'resto-logo-img',  svg: null,              display: 'inline-block' }
    ];

    if (cachedLogo) {
      logoTargets.forEach(function(t) {
        var img = document.getElementById(t.img);
        if (img && img.src !== cachedLogo) img.src = cachedLogo;
        if (img) img.style.display = t.display;
        if (t.svg) {
          var svg = document.getElementById(t.svg);
          if (svg) svg.style.display = 'none';
        }
      });
    }

    // ── Nom du restaurant ─────────────────────────────────────
    if (cachedName) {
      // Logo principal (index)
      var brandText = document.getElementById('brand-logo-text');
      if (brandText) {
        var parts = cachedName.trim().split(' ');
        brandText.innerHTML = parts.length > 1
          ? parts.slice(0, -1).join(' ') + ' <span>' + parts[parts.length - 1] + '</span>'
          : '<span>' + cachedName + '</span>';
      }
      // Nom client/serveur (dernier mot en accent)
      var restoName = document.getElementById('resto-name');
      if (restoName) {
        restoName.innerHTML = cachedName.replace(
          /(\S+)$/,
          '<span style="color:var(--accent)">$1</span>'
        );
      }
      // Nom cuisine (préfixé "· " comme dans le listener Firebase)
      var restoCuisine = document.getElementById('resto-name-cuisine');
      if (restoCuisine) restoCuisine.textContent = '· ' + cachedName;
      // Titre de page
      if (cachedName) document.title = cachedName;
    }
  }

  // Exécution synchrone immédiate. Le script est inclus APRÈS les éléments
  // de logo dans le body, donc ils sont déjà dans le DOM. Le pre-boot inline
  // dans <head> a déjà fait le minimum (couleur d'accent + style hide SVG) ;
  // ici on complète avec img.src + texte du nom.
  applyBrandToDom();
  // Filet de sécurité : si pour une raison X le DOM n'est pas prêt, on retente.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrandToDom);
  }

  // ── API publique pour persister depuis les listeners Firebase ──
  // On utilise JSON.stringify pour rester compatible avec le helper LS de
  // marmite-express-caisse.html qui sérialise toutes ses valeurs.
  function write(key, value) {
    try {
      if (value == null || value === '') localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  window.BrandCache = {
    save: function(branding) {
      if (!branding) return;
      write('brand_logoUrl', branding.logoUrl || '');
      if (branding.name)   write('brand_name',   branding.name);
      if (branding.accent) write('brand_accent', branding.accent);
    },
    clear: function() {
      try {
        localStorage.removeItem('brand_logoUrl');
        localStorage.removeItem('brand_name');
        localStorage.removeItem('brand_accent');
      } catch (e) {}
    }
  };

  // ── Reload auto si le SW signale une nouvelle version ──
  // Évite que l'utilisateur reste bloqué sur du code obsolète après une MAJ.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'SW_UPDATED') {
        // Marqueur pour éviter une boucle si l'update n'a pas pris
        var last = sessionStorage.getItem('sw_reloaded');
        if (last !== event.data.cache) {
          sessionStorage.setItem('sw_reloaded', event.data.cache);
          window.location.reload();
        }
      }
    });
  }
})();
