// resto-detector.js — utilitaire détection slug multi-tenant
// Phase 3 préparation cutover : prêt à être importé par toutes les pages.
//
// Ordre de résolution :
//   1. URL ?resto=slug  → cache localStorage + return slug
//   2. localStorage marmitte_resto_slug → return slug
//   3. null (mode legacy mono-tenant)
//
// Usage :
//   import { detectRestoSlug } from './assets/js/resto-detector.js';
//   const slug = detectRestoSlug();
//   if(!slug){ window.location.href = 'signup.html'; }

const STORAGE_KEY = 'marmitte_resto_slug';

export function detectRestoSlug() {
  try {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('resto');
    if (fromUrl) {
      const clean = String(fromUrl).trim().toLowerCase();
      if (clean) {
        localStorage.setItem(STORAGE_KEY, clean);
        return clean;
      }
    }
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch (e) {
    // localStorage peut throw en mode privé / sandbox
    console.warn('[resto-detector] storage indisponible:', e);
    try {
      const params = new URLSearchParams(location.search);
      return params.get('resto') || null;
    } catch (_) {
      return null;
    }
  }
}

export function clearRestoSlug() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

export function setRestoSlug(slug) {
  if (!slug) return;
  try { localStorage.setItem(STORAGE_KEY, String(slug).trim().toLowerCase()); } catch (_) {}
}
