// firebase-sync.js — module centralisé Firebase
// Remplace l'init dupliqué dans chaque page HTML.
// Phase 2.A.2 du plan .planning/phases/02-stabilite-fondations/02-PLAN.md
//
// Usage depuis n'importe quelle page :
//   <script type="module">
//   import { db, app } from './assets/js/firebase-sync.js';
//   // puis utiliser db avec les APIs Firestore normales
//   </script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
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

// Init app + Firestore (singletons)
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Re-export des helpers Firestore utilisés partout
// → les pages peuvent importer tout ce dont elles ont besoin depuis ce seul module.
export {
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
};

// Helpers collections — abstraction qui permettra de scoper par resto en phase 3
// Phase 2 : retourne la collection racine
// Phase 3 : sera modifié pour retourner restaurants/{slug}/collection
export function col(name) {
  return collection(db, name);
}

export function docRef(collectionName, id) {
  return doc(db, collectionName, id);
}

// Helper escape HTML (utilisé par plusieurs pages pour éviter XSS lors du rendu dynamique)
export function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// État de connexion — utilisable pour banner offline (sera complété en bloc 2.B)
export function onConnectionChange(callback) {
  window.addEventListener("online", () => callback(true));
  window.addEventListener("offline", () => callback(false));
  callback(navigator.onLine);
}
