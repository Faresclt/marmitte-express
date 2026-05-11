/* ============================================================
   theme.js — Gestion du thème dark / light / auto
   La Marmite Express

   Modes disponibles :
     - 'dark'  (défaut)    : toujours sombre
     - 'light'             : toujours clair (peu recommandé)
     - 'auto-time'         : clair 7h-19h, sombre 19h-7h
     - 'auto-system'       : suit prefers-color-scheme du système iOS

   Persistance : localStorage.theme_pref
   API publique :
     window.Theme.set('dark' | 'light' | 'auto-time' | 'auto-system')
     window.Theme.get()  → mode actuel
   ============================================================ */
(function() {
  'use strict';

  var KEY = 'theme_pref';
  var MODES = ['dark', 'light', 'auto-time', 'auto-system'];

  function getStored() {
    try {
      var v = localStorage.getItem(KEY);
      if (v && v.charAt(0) === '"') v = JSON.parse(v);
      return MODES.indexOf(v) >= 0 ? v : 'dark';
    } catch (e) { return 'dark'; }
  }

  function isDayTime() {
    var h = new Date().getHours();
    return h >= 7 && h < 19; // 7h → 19h = jour
  }

  function isSystemLight() {
    return window.matchMedia &&
           window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function effectiveTheme(mode) {
    if (mode === 'light') return 'light';
    if (mode === 'auto-time')   return isDayTime()    ? 'light' : 'dark';
    if (mode === 'auto-system') return isSystemLight() ? 'light' : 'dark';
    return 'dark';
  }

  function apply(mode) {
    var theme = effectiveTheme(mode);
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function set(mode) {
    if (MODES.indexOf(mode) < 0) mode = 'dark';
    try { localStorage.setItem(KEY, JSON.stringify(mode)); } catch (e) {}
    apply(mode);
  }

  // Application initiale
  apply(getStored());

  // Re-évaluation horaire (auto-time uniquement) toutes les 10 min
  setInterval(function() {
    if (getStored() === 'auto-time') apply('auto-time');
  }, 10 * 60 * 1000);

  // Réagit aux changements système (auto-system uniquement)
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: light)');
    var listener = function() {
      if (getStored() === 'auto-system') apply('auto-system');
    };
    if (mq.addEventListener) mq.addEventListener('change', listener);
    else if (mq.addListener) mq.addListener(listener);
  }

  window.Theme = { get: getStored, set: set, apply: apply };
})();
