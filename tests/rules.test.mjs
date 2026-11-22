// Tests des règles Firestore v5 sur l'émulateur.
// Lancer depuis la racine du repo :
//   firebase emulators:exec --only firestore --project demo-marmite "node --test tests/rules.test.mjs"
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc
} from 'firebase/firestore';

const CODE = 'TESTCODE-1234';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-marmite',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
  });
});
after(async () => { await env.cleanup(); });

async function seed(enforce) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'security/enroll'), { code: CODE });
    await setDoc(doc(db, 'security/policy'), { enforce });
    await setDoc(doc(db, 'staff/caisse'), { code: CODE, label: 'Caisse' });
    await setDoc(doc(db, 'config/menu'), { products: [], serveurPin: 'x' });
    await setDoc(doc(db, 'config/staffcfg'), { serveurPin: '4321' });
    await setDoc(doc(db, 'tables/t1'), { ticket: [] });
    await setDoc(doc(db, 'orders/o1'), { status: 'pending' });
    await setDoc(doc(db, 'tickets/k1'), { total: 10 });
    await setDoc(doc(db, 'sales/2026-11-18/v/t1_a'), { ts: 1, total: 10, payType: 'cb', hash: 'h' });
  });
}

const staff = () => env.authenticatedContext('caisse').firestore();
const anon = () => env.authenticatedContext('pirate').firestore();
const nobody = () => env.unauthenticatedContext().firestore();

const clientOrder = (uid) => ({
  tableId: 't5', tableNum: 5, items: [{ pid: 'p1', name: 'Bavette', qty: 1, price: 0.01 }],
  note: '', status: 'pending', source: 'client', sentAt: new Date(), clientUid: uid
});

// ───────── Protection ACTIVÉE ─────────
test('enforce=true : un anonyme ne peut plus rien toucher', async () => {
  await seed(true);
  const db = anon();
  await assertFails(setDoc(doc(db, 'config/menu'), { products: [] }));
  await assertFails(getDoc(doc(db, 'config/staffcfg')));
  await assertFails(deleteDoc(doc(db, 'tables/t1')));
  await assertFails(getDocs(collection(db, 'orders')));
  await assertFails(updateDoc(doc(db, 'orders/o1'), { status: 'served' }));
  await assertFails(getDocs(collection(db, 'sales/2026-11-18/v')));
  await assertFails(setDoc(doc(db, 'sales/2026-11-18/v/fake'), { ts: 2, total: 1, payType: 'cb', hash: 'x' }));
  await assertFails(setDoc(doc(db, 'security/policy'), { enforce: false }));
  await assertFails(getDoc(doc(db, 'security/enroll')));
  await assertFails(setDoc(doc(db, 'tickets/k2'), { total: 0 }));
  await assertFails(getDocs(collection(db, 'tickets')));
});

test('enforce=true : le public garde menu et ticket par id, mais ne commande plus (v84)', async () => {
  await seed(true);
  await assertSucceeds(getDoc(doc(nobody(), 'config/menu')));
  await assertSucceeds(getDoc(doc(nobody(), 'tickets/k1')));
  await assertSucceeds(getDoc(doc(nobody(), 'security/policy')));
  await assertFails(addDoc(collection(anon(), 'orders'), clientOrder('pirate')));
  await assertFails(addDoc(collection(nobody(), 'orders'), clientOrder('pirate')));
});

test('enforce=true : seul un appareil enregistré crée une commande', async () => {
  await seed(true);
  await assertSucceeds(addDoc(collection(staff(), 'orders'), { ...clientOrder('x'), source: 'serveur' }));
});

test('enforce=true : un appareil enregistré fonctionne normalement', async () => {
  await seed(true);
  const db = staff();
  await assertSucceeds(setDoc(doc(db, 'config/menu'), { products: [] }));
  await assertSucceeds(getDoc(doc(db, 'config/staffcfg')));
  await assertSucceeds(setDoc(doc(db, 'tables/t1'), { ticket: [] }));
  await assertSucceeds(getDocs(collection(db, 'orders')));
  await assertSucceeds(setDoc(doc(db, 'sales/2026-11-18/v/t2_b'), { ts: 2, total: 12.5, payType: 'especes', hash: 'h2' }));
  await assertSucceeds(getDocs(collection(db, 'sales/2026-11-18/v')));
  await assertSucceeds(setDoc(doc(db, 'closures/2026-11-18_x'), { total: 1 }));
  await assertSucceeds(setDoc(doc(db, 'counters/2026'), { receipts: 3 }));
  await assertSucceeds(setDoc(doc(db, 'backups/2026-11-18'), { data: 1 }));
  await assertSucceeds(getDocs(collection(db, 'staff')));
  await assertSucceeds(setDoc(doc(db, 'security/policy'), { enforce: false, updatedAt: 1, by: 'Caisse' }));
});

test('ventes et clôtures inaltérables, même pour la caisse', async () => {
  await seed(true);
  const db = staff();
  await assertFails(setDoc(doc(db, 'sales/2026-11-18/v/t1_a'), { ts: 1, total: 0, payType: 'cb', hash: 'h' }));
  await assertFails(deleteDoc(doc(db, 'sales/2026-11-18/v/t1_a')));
  await assertFails(setDoc(doc(db, 'sales/2026-11-18'), { x: 1 }));
  await assertSucceeds(setDoc(doc(db, 'closures/z1'), { total: 1 }));
  await assertFails(setDoc(doc(db, 'closures/z1'), { total: 2 }));
  await assertFails(deleteDoc(doc(db, 'closures/z1')));
});

test('enregistrement : bon code pour soi seulement', async () => {
  await seed(true);
  const db = anon();
  await assertFails(setDoc(doc(db, 'staff/pirate'), { code: 'MAUVAIS', label: 'x' }));
  await assertFails(setDoc(doc(db, 'staff/autre'), { code: CODE, label: 'x' }));
  await assertFails(setDoc(doc(db, 'staff/pirate'), { code: CODE, label: 'x', role: 'admin' }));
  await assertSucceeds(setDoc(doc(db, 'staff/pirate'), { code: CODE, label: 'Cuisine', page: 'cuisine', ua: 'x' }));
  // devenu staff → accès
  await assertSucceeds(getDocs(collection(db, 'orders')));
  await assertFails(updateDoc(doc(db, 'staff/pirate'), { label: 'y' }));
});

test('rotation du code : staff seulement, jamais relisible', async () => {
  await seed(true);
  await assertFails(setDoc(doc(anon(), 'security/enroll'), { code: 'NOUVEAUCODE' }));
  await assertSucceeds(setDoc(doc(staff(), 'security/enroll'), { code: 'NOUVEAUCODE', updatedAt: 1 }));
  await assertFails(getDoc(doc(staff(), 'security/enroll')));
  await assertFails(setDoc(doc(staff(), 'security/enroll'), { code: 'court' }));
});

// ───────── Transition (protection pas encore activée) ─────────
test('enforce=false : comportement v4 conservé (rien ne casse au déploiement)', async () => {
  await seed(false);
  const db = anon();
  await assertSucceeds(setDoc(doc(db, 'config/menu'), { products: [] }));
  await assertSucceeds(setDoc(doc(db, 'tables/t1'), { ticket: [] }));
  await assertSucceeds(getDocs(collection(db, 'orders')));
  await assertSucceeds(setDoc(doc(db, 'sales/2026-11-18/v/t3_c'), { ts: 3, total: 9, payType: 'cb', hash: 'h3' }));
  await assertSucceeds(setDoc(doc(db, 'counters/2026'), { receipts: 1 }));
  // mais jamais : activer/désactiver la protection, lire le code, lister les tickets
  await assertFails(setDoc(doc(db, 'security/policy'), { enforce: false }));
  await assertFails(getDoc(doc(db, 'security/enroll')));
  await assertFails(getDocs(collection(db, 'tickets')));
  await assertFails(getDoc(doc(db, 'config/apikeys')));
  await assertFails(getDoc(doc(nobody(), 'config/staffcfg')));
});

test('sans document policy : traité comme non activé', async () => {
  await env.clearFirestore();
  await assertSucceeds(setDoc(doc(anon(), 'tables/t1'), { ticket: [] }));
});
