// firebase-sync.js — module centralisé Firebase + sync queue avec retry
// Phase 2.A.2 + 2.B.2 + 2.B.3 + 2.B.4 du plan .planning/phases/02-stabilite-fondations/02-PLAN.md
//
// Usage depuis n'importe quelle page :
//   <script type="module">
//   import { db, queueOp, attachSyncBanner } from './assets/js/firebase-sync.js';
//   attachSyncBanner(); // affiche banner état connexion/queue
//   </script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
  doc,
  collection,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadString,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Config Firebase — projet "la-marmitte-express"
// Note: apiKey côté client est publique par design (sécurité = Firestore rules).
const firebaseConfig = {
  apiKey: "AIzaSyChl-uEyzbbdJfhXwOUH_rpzSIsEAbexhQ",
  authDomain: "la-marmitte-express.firebaseapp.com",
  projectId: "la-marmitte-express",
  storageBucket: "la-marmitte-express.firebasestorage.app",
  messagingSenderId: "215969803476",
  appId: "1:215969803476:web:39ee4de2cf4475f3c2df41"
};

// Init app + Firestore + Storage (singletons)
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Re-export helpers Storage utilisés par la caisse
export { storageRef, uploadString, uploadBytes, getDownloadURL, deleteObject };

// ═══════════════════════════════════════════════════════════
// IndexedDB persistence — Phase 2.D.1
// ═══════════════════════════════════════════════════════════
// Active le cache IndexedDB pour Firestore → offline reads + writes queued.
// Peut échouer si plusieurs onglets ouverts OU navigateur incompatible → try/catch gracieux.
try {
  await enableIndexedDbPersistence(db);
  console.log("[firebase-sync] IndexedDB persistence activée (offline OK)");
} catch (err) {
  if (err?.code === "failed-precondition") {
    console.warn("[firebase-sync] IndexedDB persistence: plusieurs onglets ouverts, désactivée sur celui-ci");
  } else if (err?.code === "unimplemented") {
    console.warn("[firebase-sync] IndexedDB persistence: navigateur non compatible");
  } else {
    console.warn("[firebase-sync] IndexedDB persistence erreur:", err);
  }
}

// ═══════════════════════════════════════════════════════════
// Firebase Auth anonyme — Phase 2.C.1
// ═══════════════════════════════════════════════════════════
// Connecte l'utilisateur de façon anonyme (UID Firebase sans compte explicite).
// Préparation pour les Firestore rules strictes qui exigent request.auth != null.
// Si Firebase Auth anonyme n'est pas encore activé côté Console Firebase, on log un warning
// mais l'app continue de fonctionner avec les règles permissives actuelles.
export const authReady = (async () => {
  try {
    await signInAnonymously(auth);
    console.log("[firebase-sync] Auth anonyme OK, UID:", auth.currentUser?.uid);
    return auth.currentUser;
  } catch (err) {
    console.warn(
      "[firebase-sync] Auth anonyme échouée — activer dans Firebase Console > Authentication > Sign-in method > Anonymous. Erreur:",
      err?.code || err?.message
    );
    return null;
  }
})();

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUid() {
  return auth.currentUser?.uid || null;
}

// ═══════════════════════════════════════════════════════════
// Multi-tenant scoping — Phase 3 cutover (DESACTIVE temporairement)
// ═══════════════════════════════════════════════════════════
// Cause : rules.v3 exige isResto/isAdmin pour ecrire dans restaurants/{slug}/ .
// Sans seed users + admin auth proper, ecritures bloquees par rules.
// Revert : tout passe par root collections (backward compat).
// Re-activation prevue : Phase 5 quand auth admin par-resto en place.
function _detectSlug() {
  // Forcer null = mode legacy root (sécurise prod parents).
  // Nettoie localStorage cache si trainant d'un test précédent.
  try { localStorage.removeItem('marmitte_resto_slug'); } catch (_) {}
  return null;
}
export const RESTO_SLUG = _detectSlug();
const _MT_PREFIX = null; // forcé null jusqu'a re-activation phase 5

// Wrappers : si slug actif, préfixe restaurants/{slug}/ devant le path.
// Si pas de slug : passe-plat vers les fonctions natives (mode legacy).
function _isFirestoreInstance(x) {
  // Firestore instance has _settings, _databaseId, etc. Simple heuristic.
  return x && typeof x === 'object' && (x.type === 'firestore' || x._databaseId !== undefined || x.app !== undefined);
}

function scopedDoc(...args) {
  // Signature originale: doc(firestore, collectionPath, docId, ...) ou doc(firestore, path)
  if (!_MT_PREFIX) return doc(...args);
  if (args.length >= 2 && _isFirestoreInstance(args[0])) {
    return doc(args[0], ..._MT_PREFIX, ...args.slice(1));
  }
  return doc(...args);
}

function scopedCollection(...args) {
  if (!_MT_PREFIX) return collection(...args);
  if (args.length >= 2 && _isFirestoreInstance(args[0])) {
    return collection(args[0], ..._MT_PREFIX, ...args.slice(1));
  }
  return collection(...args);
}

// Re-export : doc/collection sont scopés. Les pages appelantes ne changent pas.
export {
  scopedDoc as doc,
  scopedCollection as collection,
  onSnapshot,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
};

// Helpers col/docRef — Phase 3 : scopés automatiquement via wrappers ci-dessous.
export function col(name) {
  return scopedCollection(db, name);
}

export function docRef(collectionName, id) {
  return scopedDoc(db, collectionName, id);
}

// Helper escape HTML (utilisé par plusieurs pages pour éviter XSS lors du rendu dynamique)
export function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ═══════════════════════════════════════════════════════════
// Branding icons : applique logoUrl partout (favicon, apple-touch, pin-logo)
// ═══════════════════════════════════════════════════════════
const _BRAND_CACHE_KEY = 'marmitte_brand_logo_url';

function _setLinkIcon(rel, href, sizes) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (sizes) el.setAttribute('sizes', sizes);
}

export function applyBrandingIcons(logoUrl, opts = {}) {
  if (!logoUrl) return;
  const brandName = (opts.name || '').trim();
  // 1. Favicon + apple-touch-icon (PWA install + onglet)
  _setLinkIcon('icon', logoUrl, '192x192');
  _setLinkIcon('apple-touch-icon', logoUrl);
  _setLinkIcon('apple-touch-icon-precomposed', logoUrl);
  _setLinkIcon('shortcut icon', logoUrl);
  // 2. Pin screen logo (caisse uniquement)
  const pinLogo = document.getElementById('pin-logo');
  if (pinLogo) {
    pinLogo.style.background = '#0c0d10';
    pinLogo.style.padding = '0';
    pinLogo.style.overflow = 'hidden';
    pinLogo.innerHTML = `<img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`;
  }
  // 3. Manifest PWA dynamique : génère un manifest avec le logo upload
  // pour que "Ajouter à l'écran d'accueil" iOS/Android utilise ton logo,
  // pas l'icône statique icon-192.png/icon-512.png.
  try {
    const manifest = {
      name: brandName || 'La Marmite Express',
      short_name: (brandName || 'Marmite').slice(0, 12),
      description: 'Système de caisse & commande en ligne',
      start_url: './index.html',
      scope: './',
      display: 'standalone',
      background_color: '#0a0b0e',
      theme_color: '#f5a623',
      orientation: 'any',
      categories: ['business', 'food'],
      icons: [
        { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const url = URL.createObjectURL(blob);
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link._dynamicUrl) URL.revokeObjectURL(link._dynamicUrl);
    link._dynamicUrl = url;
    link.href = url;
  } catch (e) {
    console.warn('[brand] manifest dynamique échoué:', e);
  }
  // 4. Cache localStorage pour appliquer instantanément au prochain chargement
  try {
    localStorage.setItem(_BRAND_CACHE_KEY, logoUrl);
    if (brandName) localStorage.setItem('marmitte_brand_name', brandName);
  } catch (_) {}
}

// Auto-apply cached logo immediately at module load (avant Firestore async).
try {
  const cached = localStorage.getItem(_BRAND_CACHE_KEY);
  const cachedName = localStorage.getItem('marmitte_brand_name') || '';
  if (cached) applyBrandingIcons(cached, { name: cachedName });
} catch (_) {}

// Auto-listen Firestore config/menu pour propager logoUrl à toutes les pages
// sans avoir à modifier chaque listener existant.
try {
  onSnapshot(scopedDoc(db, 'config', 'menu'), (snap) => {
    if (snap.exists && typeof snap.data === 'function') {
      const b = (snap.data() || {}).branding || {};
      if (b.logoUrl) applyBrandingIcons(b.logoUrl, { name: b.name || '' });
    }
  });
} catch (e) {
  console.warn('[firebase-sync] auto-listen branding échoué:', e);
}

// ═══════════════════════════════════════════════════════════
// SYNC QUEUE — Phase 2.B.2 + 2.B.3
// ═══════════════════════════════════════════════════════════
//
// Queue write-through : toute écriture Firestore peut être mise en file si offline.
// Au retour en ligne, le processeur retry avec exponential backoff.
// Persistance localStorage pour survie au reload.

const QUEUE_KEY = "sync_queue_v1";
const FAILED_KEY = "sync_queue_failed_v1";
const MAX_RETRIES = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]; // capped à 16s

let queueProcessing = false;
const listeners = new Set();

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.warn("[sync-queue] localStorage plein, opération perdue:", e);
  }
  notifyListeners();
}

function readFailed() {
  try {
    return JSON.parse(localStorage.getItem(FAILED_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeFailed(f) {
  try {
    localStorage.setItem(FAILED_KEY, JSON.stringify(f));
  } catch (e) {
    console.warn("[sync-queue] impossible de persister failed:", e);
  }
}

/**
 * Ajoute une opération Firestore à la queue.
 * Si on est en ligne, le processeur est déclenché immédiatement.
 *
 * @param {Object} op { type: 'set'|'update'|'delete', collection, docId, data? }
 * @returns {string} queueId de l'op (pour suivi)
 */
export function queueOp(op) {
  const id = "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const entry = {
    id,
    ...op,
    timestamp: Date.now(),
    retries: 0
  };
  const q = readQueue();
  q.push(entry);
  writeQueue(q);
  processQueue();
  return id;
}

async function executeOp(op) {
  const ref = scopedDoc(db, op.collection, op.docId);
  if (op.type === "set") {
    await setDoc(ref, op.data);
  } else if (op.type === "update") {
    await updateDoc(ref, op.data);
  } else if (op.type === "delete") {
    await deleteDoc(ref);
  } else {
    throw new Error("Type d'opération inconnu: " + op.type);
  }
}

async function processQueue() {
  if (queueProcessing) return;
  if (!navigator.onLine) return;

  queueProcessing = true;
  try {
    let q = readQueue();
    while (q.length > 0 && navigator.onLine) {
      const op = q[0];
      try {
        await executeOp(op);
        // Succès : retirer de la queue
        q = q.slice(1);
        writeQueue(q);
      } catch (err) {
        op.retries = (op.retries || 0) + 1;
        console.warn(
          "[sync-queue] Retry " + op.retries + "/" + MAX_RETRIES + " pour " + op.id + ":",
          err?.message || err
        );
        if (op.retries >= MAX_RETRIES) {
          // Trop d'échecs : déplacer en failed
          const failed = readFailed();
          failed.push({ ...op, failedAt: Date.now(), error: err?.message || String(err) });
          writeFailed(failed);
          q = q.slice(1);
          writeQueue(q);
          console.error("[sync-queue] OP ABANDONNÉE après " + MAX_RETRIES + " retries:", op);
        } else {
          // Persist retry count et attendre backoff
          q[0] = op;
          writeQueue(q);
          const wait = BACKOFF_MS[Math.min(op.retries - 1, BACKOFF_MS.length - 1)];
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
  } finally {
    queueProcessing = false;
    notifyListeners();
  }
}

/**
 * Retourne l'état courant de la sync (utile pour UI).
 */
export function getSyncState() {
  return {
    online: navigator.onLine,
    pending: readQueue().length,
    failed: readFailed().length,
    processing: queueProcessing
  };
}

/**
 * S'abonne aux changements d'état de sync.
 * Appelle `callback(state)` à chaque changement.
 */
export function onSyncChange(callback) {
  listeners.add(callback);
  callback(getSyncState()); // initial
  return () => listeners.delete(callback);
}

function notifyListeners() {
  const state = getSyncState();
  listeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.error("[sync-queue] listener error:", e);
    }
  });
}

// Déclenche le processeur au retour en ligne
window.addEventListener("online", () => {
  notifyListeners();
  processQueue();
});
window.addEventListener("offline", () => notifyListeners());

// Déclenche au load (traite les ops pendantes d'une session précédente)
if (navigator.onLine && readQueue().length > 0) {
  processQueue();
}

// ═══════════════════════════════════════════════════════════
// UI BANNER — Phase 2.B.4
// ═══════════════════════════════════════════════════════════

/**
 * Attache un banner sticky en bas de page pour afficher l'état sync.
 * Les classes CSS sont dans assets/css/design-system.css (.sync-banner).
 *
 * @param {Object} opts { autoHideOk: true } — si true, masque le banner quand online et queue vide
 */
export function attachSyncBanner(opts = { autoHideOk: true }) {
  // S'assurer que design-system.css est chargé (sinon injecter un style fallback minimal)
  if (!document.querySelector('link[href*="design-system.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./assets/css/design-system.css";
    document.head.appendChild(link);
  }

  const banner = document.createElement("div");
  banner.className = "sync-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  document.body.appendChild(banner);

  const render = (state) => {
    banner.classList.remove("offline", "pending", "online", "visible");
    if (!state.online) {
      banner.textContent = "Hors ligne — les modifications seront synchronisées au retour";
      banner.classList.add("offline", "visible");
    } else if (state.pending > 0 || state.processing) {
      banner.textContent =
        "Synchronisation… " + state.pending + " opération" + (state.pending > 1 ? "s" : "") + " en attente";
      banner.classList.add("pending", "visible");
    } else if (state.failed > 0) {
      banner.textContent = state.failed + " opération(s) ont échoué — voir la console";
      banner.classList.add("offline", "visible");
    } else {
      banner.textContent = "Synchronisé";
      banner.classList.add("online");
      if (!opts.autoHideOk) banner.classList.add("visible");
    }
  };

  onSyncChange(render);
  return banner;
}

// État de connexion — utilisable pour banner offline
export function onConnectionChange(callback) {
  window.addEventListener("online", () => callback(true));
  window.addEventListener("offline", () => callback(false));
  callback(navigator.onLine);
}
