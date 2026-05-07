/* ============================================================
   tap-feedback.js — Effet ripple Material-style au tap/click
   sur tout élément portant la classe `.ripple`.

   Auto-bind via délégation sur document, donc fonctionne aussi
   pour les éléments ajoutés dynamiquement (cards de menu,
   filtres, etc.).

   Désactivé automatiquement si prefers-reduced-motion.
   ============================================================ */
(function() {
  'use strict';

  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  function spawn(target, x, y) {
    var rect = target.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 0.6;
    var wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.width = wave.style.height = size + 'px';
    wave.style.left = (x - rect.left - size / 2) + 'px';
    wave.style.top  = (y - rect.top  - size / 2) + 'px';

    target.appendChild(wave);
    setTimeout(function() {
      if (wave.parentNode) wave.parentNode.removeChild(wave);
    }, 650);
  }

  // Sélecteurs auto-ripplés (pas besoin d'ajouter .ripple manuellement)
  var AUTO_SELECTORS = '.ripple, .btn, .app-card, .card-interactive, .chip, .add-btn, .mtab, .pin-key, .tbtn, .hbtn';

  function findRippleTarget(el) {
    while (el && el !== document.body) {
      if (el.matches && el.matches(AUTO_SELECTORS)) return el;
      el = el.parentElement;
    }
    return null;
  }

  // pointerdown couvre touch, pen et mouse de façon unifiée
  document.addEventListener('pointerdown', function(e) {
    if (e.button !== undefined && e.button !== 0) return; // left click only
    var target = findRippleTarget(e.target);
    if (!target) return;
    spawn(target, e.clientX, e.clientY);
  }, { passive: true });
})();
