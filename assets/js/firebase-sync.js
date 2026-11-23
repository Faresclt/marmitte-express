// firebase-sync.js — module centralisé Firebase (auth, Firestore, Storage, sécurité des appareils)
// Phase 2.A.2 + 2.B.2 + 2.B.3 + 2.B.4 du plan .planning/phases/02-stabilite-fondations/02-PLAN.md
//

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  enableIndexedDbPersistence,
  doc,
  collection,
  onSnapshot,
  getDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  connectAuthEmulator
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
// ignoreUndefinedProperties : un champ `undefined` (ex. stock « illimité »)
// faisait rejeter TOUT le document (backup, table) en silence.
// Mode émulateur (tests locaux) : polling long forcé, le flux par défaut est
// instable contre l'émulateur. Sans effet en prod.
const _EMU_WANTED = (() => {
  try {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      && (new URLSearchParams(location.search).has("emu") || sessionStorage.getItem("fb_emu") === "1");
  } catch (_) { return false; }
})();
export const db = initializeFirestore(app, _EMU_WANTED
  ? { ignoreUndefinedProperties: true, experimentalForceLongPolling: true }
  : { ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const storage = getStorage(app);

// Mode test LOCAL : http://localhost:…/page.html?emu → émulateurs Firebase
// (aucune donnée de prod touchée). Inactif hors localhost.
export const EMULATOR = (() => {
  try {
    const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!local) return false;
    if (new URLSearchParams(location.search).has("emu")) sessionStorage.setItem("fb_emu", "1");
    return sessionStorage.getItem("fb_emu") === "1";
  } catch (_) { return false; }
})();
if (EMULATOR) {
  connectFirestoreEmulator(db, "127.0.0.1", 8085);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  console.warn("[firebase-sync] MODE ÉMULATEUR (test local)");
}

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

// Token pour les fallbacks REST (orders-rest-poll.js) — rules v4 exigent auth.
export async function getIdToken() {
  try {
    await authReady;
    return auth.currentUser ? await auth.currentUser.getIdToken() : null;
  } catch (_) {
    return null;
  }
}
try { window.__fbGetIdToken = getIdToken; } catch (_) {}

// ═══════════════════════════════════════════════════════════
// onSnapshot auth-aware — fix critique rules v4
// ═══════════════════════════════════════════════════════════
// /orders et /tables exigent request.auth != null depuis rules v4, mais les
// pages attachent leurs listeners au chargement, souvent AVANT que
// signInAnonymously (asynchrone) aboutisse. Un listener Firestore qui reçoit
// permission-denied est TERMINÉ — jamais ré-abonné automatiquement. Symptôme
// réel constaté : cuisine vide / plan de salle sans tables occupées selon
// l'appareil (course d'auth gagnée ou perdue au boot).
// Ce wrapper attend authReady avant d'attacher, puis ré-attache jusqu'à 5 fois
// (2.5s d'intervalle) sur permission-denied — couvre aussi la propagation du
// token juste après le sign-in.
function authAwareOnSnapshot(target, ...cbs) {
  let next = cbs[0];
  let errCb = cbs[1];
  // Forme observer { next, error }
  if (next && typeof next === "object" && (typeof next.next === "function" || typeof next.error === "function")) {
    errCb = next.error;
    next = next.next;
  }
  // Forme options ({ includeMetadataChanges }, next, error)
  else if (next && typeof next === "object" && typeof cbs[1] === "function") {
    next = cbs[1];
    errCb = cbs[2];
  }
  let unsub = null;
  let stopped = false;
  let retries = 0;
  const attach = () => {
    if (stopped) return;
    unsub = onSnapshot(
      target,
      (snap) => {
        retries = 0;
        if (typeof next === "function") next(snap);
      },
      (err) => {
        if (err && err.code === "permission-denied" && retries < 5) {
          retries++;
          console.warn("[firebase-sync] listener permission-denied — retry " + retries + "/5 dans 2.5s (auth pas encore propagée ?)");
          setTimeout(attach, 2500);
          return;
        }
        if (typeof errCb === "function") errCb(err);
        else console.error("[firebase-sync] listener mort:", err && (err.code || err.message));
      }
    );
  };
  authReady.then(attach, attach);
  return () => {
    stopped = true;
    if (unsub) { try { unsub(); } catch (_) {} }
  };
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

// Re-export : doc/collection sont scopés, onSnapshot est auth-aware.
// Les pages appelantes ne changent pas.
export {
  scopedDoc as doc,
  scopedCollection as collection,
  authAwareOnSnapshot as onSnapshot,
  getDoc,
  getDocs,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  runTransaction
};

// Helpers col/docRef — Phase 3 : scopés automatiquement via wrappers ci-dessous.
export function col(name) {
  return scopedCollection(db, name);
}

export function docRef(collectionName, id) {
  return scopedDoc(db, collectionName, id);
}

// Helper escape HTML (utilisé par plusieurs pages pour éviter XSS lors du rendu dynamique).
// Échappe aussi l'apostrophe : sans ça, une valeur placée dans un onclick='...' ou
// un attribut entre apostrophes peut sortir de son contexte.
export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// URL sûre pour src/href : uniquement https:, data:image/(raster) ou relative.
// Bloque javascript:, data:text/html, data:image/svg+xml, etc.
// Photos du site : images/x.png (2 à 7 Mo, 2816 px) → version WebP déjà générée
// dans images/optimized/x-<taille>.webp (thumb 200 px ≈ 4 Ko, medium 600 px ≈ 27 Ko,
// full 1200 px ≈ 90 Ko). Conversion à l'affichage : marche quelle que soit la
// source (cloud, caisse, carte-2026) sans réécrire les données (v85).
export function optImg(u, size = "medium") {
  const s = String(u ?? "").trim();
  const m = /^(?:\.\/)?images\/([a-z0-9_\-.%]+)\.(png|jpe?g)$/i.exec(s);
  return m ? `images/optimized/${m[1]}-${size}.webp` : s;
}

export function safeUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https:\/\//i.test(s)) return s;
  if (/^data:image\/(png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  // Chemin relatif du site (ex. « images/soda.png », « ./assets/x.webp ») :
  // aucun schéma possible (pas de « : »), pas de « // » initial.
  if (!/^\/\//.test(s) && /^[a-z0-9_\-./%]+\.(png|jpe?g|webp|gif|avif)(\?[a-z0-9=&_.-]*)?$/i.test(s)) return s;
  return "";
}
// Couleur CSS sûre (pour --accent etc.) : #hex uniquement.
export function safeColor(c, fallback = "") {
  const s = String(c ?? "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : fallback;
}
try { window.__safe = { escHtml, safeUrl, safeColor }; } catch (_) {}

// ═══════════════════════════════════════════════════════════
// APPAREILS DU RESTO (staff) — v5 sécurité, 2026-11-18
// ═══════════════════════════════════════════════════════════
// Chaque appareil du resto s'enregistre UNE fois avec le code secret
// (security/enroll, illisible). Ça crée staff/{uid anonyme de l'appareil}.
// Les règles Firestore n'autorisent alors que ces appareils, dès que la caisse
// a activé la protection (security/policy.enforce). Avant activation : tout
// fonctionne comme avant, un bandeau invite seulement à enregistrer l'appareil.

const _staff = { uid: null, isStaff: false, enforced: false, checked: false, label: "" };
const _staffSubs = new Set();
function _emitStaff() { _staffSubs.forEach((cb) => { try { cb({ ..._staff }); } catch (_) {} }); }
export function onStaffChange(cb) { _staffSubs.add(cb); if (_staff.checked) cb({ ..._staff }); return () => _staffSubs.delete(cb); }

// Vérification paresseuse : seules les pages du personnel la déclenchent
// (requireStaff / window.__staff) — la carte client QR ne paie pas ces lectures.
let _staffPromise = null;
export function staffReady() {
  if (!_staffPromise) _staffPromise = _checkStaff();
  return _staffPromise;
}
async function _checkStaff() {
  await authReady;
  _staff.uid = auth.currentUser?.uid || null;
  if (!_staff.uid) { _staff.checked = true; _emitStaff(); return { ..._staff }; }
  try {
    const s = await getDoc(doc(db, "staff", _staff.uid));
    _staff.isStaff = s.exists();
    if (s.exists()) _staff.label = (s.data() || {}).label || "";
  } catch (_) { _staff.isStaff = false; }
  try {
    const p = await getDoc(doc(db, "security", "policy"));
    _staff.enforced = p.exists() && (p.data() || {}).enforce === true;
  } catch (_) {}
  _staff.checked = true;
  _emitStaff();
  // Suivi temps réel de l'activation de la protection
  try {
    onSnapshot(doc(db, "security", "policy"), (snap) => {
      const e = snap.exists() && (snap.data() || {}).enforce === true;
      if (e !== _staff.enforced) { _staff.enforced = e; _emitStaff(); }
    }, () => {});
  } catch (_) {}
  return { ..._staff };
}

export function getStaffStatus() { return { ..._staff }; }

export async function enrollDevice(code, label, page) {
  await authReady;
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Connexion Firebase impossible (réseau ?)");
  await setDoc(doc(db, "staff", uid), {
    code: String(code || "").trim(),
    label: String(label || "").slice(0, 40),
    page: String(page || "").slice(0, 20),
    ua: String(navigator.userAgent || "").slice(0, 300),
    enrolledAt: Date.now()
  });
  _staff.isStaff = true; _staff.label = label || "";
  _emitStaff();
  return true;
}

export async function listStaffDevices() {
  const snap = await getDocs(collection(db, "staff"));
  return snap.docs.map((d) => {
    const x = d.data() || {};
    return { uid: d.id, label: x.label || "", page: x.page || "", ua: x.ua || "", enrolledAt: x.enrolledAt || 0, me: d.id === _staff.uid };
  });
}
export async function revokeStaffDevice(uid) { await deleteDoc(doc(db, "staff", uid)); }
export async function setEnforce(on) {
  await setDoc(doc(db, "security", "policy"), { enforce: !!on, updatedAt: Date.now(), by: _staff.label || "caisse" });
  _staff.enforced = !!on; _emitStaff();
}
export async function rotateEnrollCode(newCode) {
  await setDoc(doc(db, "security", "enroll"), { code: String(newCode).trim(), updatedAt: Date.now() });
}
try {
  window.__staff = { ready: staffReady, status: getStaffStatus, enroll: enrollDevice, list: listStaffDevices,
    revoke: revokeStaffDevice, setEnforce, rotateCode: rotateEnrollCode, onChange: onStaffChange };
} catch (_) {}

// UI d'enregistrement pour les pages du personnel (caisse, cuisine, serveur…).
// - protection non activée + appareil non enregistré : petit bandeau discret.
// - protection activée + appareil non enregistré : écran bloquant avec saisie du code.
export function requireStaff({ label = "", page = "" } = {}) {
  const DISMISS_KEY = "staff_banner_dismissed";
  let bar = null, wall = null;
  const css = "position:fixed;left:0;right:0;z-index:2147483000;font-family:'DM Sans',system-ui,-apple-system,sans-serif;";
  const remove = (el) => { if (el && el.parentNode) el.parentNode.removeChild(el); };

  async function askAndEnroll(errEl, input, btn) {
    const code = (input.value || "").trim();
    if (code.length < 6) { errEl.textContent = "Code trop court."; return; }
    btn.disabled = true; btn.textContent = "Vérification…"; errEl.textContent = "";
    try {
      let name = label;
      try { name = (localStorage.getItem("device_label") || label || page || "Appareil"); } catch (_) {}
      await enrollDevice(code, name, page);
      btn.textContent = "✓ Appareil enregistré";
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Enregistrer";
      errEl.textContent = (e && e.code === "permission-denied") ? "Code incorrect." : ("Échec : " + (e && (e.code || e.message)));
    }
  }

  function form() {
    const box = document.createElement("div");
    box.innerHTML =
      '<div style="font-family:\'Bebas Neue\',sans-serif;font-weight:400;font-size:22px;letter-spacing:1px;line-height:1.1;color:#f5a623;margin-bottom:6px">🔒 Appareil non enregistré</div>' +
      '<div style="font-size:13px;opacity:.8;margin-bottom:12px">Saisissez le code d\'enregistrement du resto (une seule fois par appareil).</div>' +
      '<input type="password" autocomplete="off" inputmode="text" placeholder="Code d\'enregistrement" style="width:100%;box-sizing:border-box;height:44px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;padding:0 12px;font-size:16px">' +
      '<button type="button" style="margin-top:10px;width:100%;height:44px;border-radius:10px;border:0;background:#f5a623;color:#000;font-weight:800;font-size:15px">Enregistrer</button>' +
      '<div class="err" style="color:#ff6b6b;font-size:13px;margin-top:8px;min-height:16px"></div>';
    const input = box.querySelector("input"), btn = box.querySelector("button"), err = box.querySelector(".err");
    btn.addEventListener("click", () => askAndEnroll(err, input, btn));
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") askAndEnroll(err, input, btn); });
    return box;
  }

  function render(st) {
    if (!st.checked || !st.uid) return;
    if (st.isStaff) { remove(bar); remove(wall); bar = wall = null; return; }
    if (st.enforced) {
      remove(bar); bar = null;
      if (wall) return;
      wall = document.createElement("div");
      wall.setAttribute("style", css + "top:0;bottom:0;background:rgba(5,6,8,.97);color:#fff;display:flex;align-items:center;justify-content:center;padding:20px");
      const card = document.createElement("div");
      card.setAttribute("style", "max-width:360px;width:100%;background:#1a1c22;border:1px solid #333;border-radius:16px;padding:22px");
      card.appendChild(form());
      wall.appendChild(card);
      document.body.appendChild(wall);
      return;
    }
    remove(wall); wall = null;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"; } catch (_) {}
    if (dismissed || bar) return;
    bar = document.createElement("div");
    bar.setAttribute("style", css + "top:0;background:#3a2a00;color:#ffd27a;font-size:13px;padding:8px 12px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap");
    bar.innerHTML = '<span>🔒 Cet appareil n\'est pas encore enregistré (sécurité).</span>';
    const go = document.createElement("button");
    go.textContent = "Enregistrer";
    go.setAttribute("style", "border:0;border-radius:8px;background:#f5a623;color:#000;font-weight:800;padding:5px 12px");
    const later = document.createElement("button");
    later.textContent = "Plus tard";
    later.setAttribute("style", "border:1px solid #ffd27a55;border-radius:8px;background:transparent;color:#ffd27a;padding:5px 10px");
    later.addEventListener("click", () => { try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch (_) {} remove(bar); bar = null; });
    go.addEventListener("click", () => {
      remove(bar); bar = null;
      const w = document.createElement("div");
      w.setAttribute("style", css + "top:0;bottom:0;background:rgba(5,6,8,.85);color:#fff;display:flex;align-items:center;justify-content:center;padding:20px");
      const card = document.createElement("div");
      card.setAttribute("style", "max-width:360px;width:100%;background:#1a1c22;border:1px solid #333;border-radius:16px;padding:22px;position:relative");
      const close = document.createElement("button");
      close.textContent = "✕";
      close.setAttribute("style", "position:absolute;top:8px;right:10px;border:0;background:transparent;color:#aaa;font-size:18px");
      close.addEventListener("click", () => remove(w));
      card.appendChild(close); card.appendChild(form()); w.appendChild(card); document.body.appendChild(w);
    });
    bar.appendChild(go); bar.appendChild(later);
    document.body.appendChild(bar);
  }
  const start = () => onStaffChange(render);
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  return staffReady();
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
  // logoUrl vient de config/menu (ou du cache localStorage) : jamais de
  // javascript:/data:text/html/svg — sinon XSS persistant via le cache.
  logoUrl = safeUrl(logoUrl);
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
