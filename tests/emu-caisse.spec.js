// Parcours critiques de la caisse sur émulateurs Firebase (voir playwright.emu.config.js).
import { test, expect } from '@playwright/test';
import { collectConsoleErrors } from './helpers.js';

const EMU = 'http://127.0.0.1:8085/v1/projects/la-marmitte-express/databases/(default)/documents';
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const CODE = 'CODE-TEST-1234';

async function adminSet(path, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) =>
    [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }])) };
  const r = await fetch(`${EMU}/${path}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('adminSet ' + path + ' ' + r.status);
}
async function adminList(path) {
  const r = await fetch(`${EMU}/${path}?pageSize=300`, { headers: ADMIN });
  const j = await r.json();
  return j.documents || [];
}
async function adminGet(path) {
  const r = await fetch(`${EMU}/${path}`, { headers: ADMIN });
  return r.ok ? r.json() : null;
}

async function openCaisse(page) {
  const errors = collectConsoleErrors(page);
  if (process.env.DEBUG_PAGE) page.on('console', (m) => { if (m.type() === 'error' || /import|order|error|sales|warn|FIRESTORE/i.test(m.text())) console.log('[page]', m.type(), m.text().slice(0, 300)); });
  page.on('dialog', (d) => d.accept());
  await page.goto('marmite-express-caisse.html?emu', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.FB && window.FB.getCol && window.__staff), null, { timeout: 45_000 });
  // Laisse l'auth anonyme se faire
  await page.waitForTimeout(1500);
  return errors;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/la-marmitte-express/databases/(default)/documents', { method: 'DELETE' });
  await adminSet('security/enroll', { code: CODE });
  await adminSet('security/policy', { enforce: false });
});

test('vente directe en ESPÈCES → historique ET cloud en espèces (pas CB), chaînée', async ({ page }) => {
  const errors = await openCaisse(page);
  const day = await page.evaluate(() => serviceDayKey());
  await page.evaluate(() => { addToTicketDirect('p8'); openPay(); selectPayType('cash'); validatePay(); });
  const local = await page.evaluate((d) => JSON.parse(localStorage.getItem('sales_' + d) || '[]'), day);
  expect(local).toHaveLength(1);
  expect(local[0].payType).toBe('cash');
  expect(local[0].total).toBe(5);
  await expect.poll(async () => (await adminList(`sales/${day}/v`)).length, { timeout: 20_000 }).toBe(1);
  const doc = (await adminList(`sales/${day}/v`))[0];
  expect(doc.fields.payType.stringValue).toBe('cash');
  expect(doc.fields.hash.stringValue).toMatch(/^[0-9a-f]{64}$/);
  expect(doc.fields.prevHash.stringValue).toBe('GENESIS');
  expect(errors.filter(e => !/\[SW\]/.test(e))).toEqual([]); // SW bloqué volontairement en test
});

test('table : convive payé en espèces + reste en CB → 2 ventes justes, part payée retirée du cloud', async ({ page }) => {
  await openCaisse(page);
  const day = await page.evaluate(() => serviceDayKey());
  const tid = await page.evaluate(() => {
    const t = salleElements.find(e => e.type === 'table-round' || e.type === 'table-rect');
    openTableModal(t.id);
    addPerson(); addPerson();
    setActivePerson(persons[0].id); addToTicketDirect('p8');           // 5,00 pour Personne 1
    setActivePerson(persons[1].id); addToTicketDirect('p8'); addToTicketDirect('p8'); // 10,00 pour Personne 2
    setActivePerson(persons[1].id);
    return t.id;
  });
  await page.evaluate(() => { payPerson(persons[0].id); selectPayType('cash'); validatePay(); });
  // C2 : le cloud ne contient plus que la part de la Personne 2
  await expect.poll(async () => {
    const d = await adminGet(`tables/${tid}`);
    return d ? Number(d.fields.total.integerValue ?? d.fields.total.doubleValue) : -1;
  }, { timeout: 15_000 }).toBe(10);
  await page.evaluate(() => { payAllAndClose(); selectPayType('cb'); validatePay(); });
  const local = await page.evaluate((d) => JSON.parse(localStorage.getItem('sales_' + d) || '[]'), day);
  const last2 = local.slice(-2);
  expect(last2.map(s => s.payType)).toEqual(['cash', 'cb']);
  expect(last2.map(s => s.total)).toEqual([5, 10]);
  await expect.poll(async () => (await adminList(`sales/${day}/v`)).length, { timeout: 20_000 }).toBe(3);
});

test('commande client au prix truqué + nom piégé → prix et nom du MENU ; annulation cuisine retire la ligne', async ({ page }) => {
  await openCaisse(page);
  const tid = await page.evaluate(() => salleElements.find(e => e.type === 'table-round' || e.type === 'table-rect').id);
  // Commande écrite côté « client » dans l'émulateur
  const orderId = await page.evaluate(async (tid) => {
    const r = await window.FB.add('orders', { tableId: tid, tableNum: 1, status: 'pending', source: 'client', note: '',
      items: [{ pid: 'p7', name: '<img src=x onerror="window.__pwned=1">', price: 0.01, qty: 2, sirop: true },
              { pid: 'zzz-inconnu', name: 'Truc inventé', price: 0.01, qty: 1 }] });
    return r.id;
  }, tid);
  // Ce que fait le listener (processPendingOrders) : import + passage à « received »
  // (appelé directement : le flux temps réel de l'émulateur est instable en test).
  await page.evaluate(async ({ tid, orderId }) => {
    importOrderToTable({ _id: orderId, tableId: tid, tableNum: 1, status: 'pending', source: 'client',
      items: [{ pid: 'p7', name: '<img src=x onerror="window.__pwned=1">', price: 0.01, qty: 2, sirop: true },
              { pid: 'zzz-inconnu', name: 'Truc inventé', price: 0.01, qty: 1 }] });
    await window.FB.markReceived(orderId);
  }, { tid, orderId });
  const rows = await page.evaluate((tid) => tableData[tid].ticket.filter(r => r._orderId), tid);
  const main = rows.find(r => r.pid === 'p7');
  expect(main.price).toBe(4);                      // prix du menu (carte 2026), pas 0,01
  expect(main.name).toBe('San Pellegrino 50cl');   // nom du menu, pas le HTML piégé
  expect(main.qty).toBe(2);
  expect(rows.find(r => r.pid === 'p7_sirop').qty).toBe(2);   // supplément sirop facturé ×2
  expect(rows.find(r => r.pid === 'zzz-inconnu').price).toBe(0); // inconnu + client → 0 € + alerte
  // La table est bien synchronisée (pas de champ undefined qui bloque l'écriture)
  await expect.poll(async () => { const d = await adminGet(`tables/${tid}`); return d ? d.fields.status.stringValue : null; }, { timeout: 15_000 }).toBe('occupied');
  expect((await adminGet(`orders/${orderId}`)).fields.status.stringValue).toBe('received');
  // markReceived ne fait jamais reculer une commande déjà en préparation
  await fetch(`${EMU}/orders/${orderId}?updateMask.fieldPaths=status`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: { status: { stringValue: 'preparing' } } }) });
  await page.evaluate((id) => window.FB.markReceived(id), orderId);
  expect((await adminGet(`orders/${orderId}`)).fields.status.stringValue).toBe('preparing');
  // Annulation en cuisine → lignes retirées de l'addition
  await page.evaluate((orderId) => removeCancelledOrder({ _id: orderId, status: 'cancelled' }), orderId);
  expect(await page.evaluate((tid) => tableData[tid].ticket.filter(r => r._orderId).length, tid)).toBe(0);
  await page.evaluate((tid) => { openTableModal(tid); renderTicket(); renderTableModal(); }, tid);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('annulation d\'une vente → doc cancel séparé, vente d\'origine intacte', async ({ page }) => {
  await openCaisse(page);
  const day = await page.evaluate(() => serviceDayKey());
  await page.evaluate(() => { addToTicketDirect('p8'); openPay(); selectPayType('cash'); validatePay(); });
  const key = await page.evaluate((d) => JSON.parse(localStorage.getItem('sales_' + d)).filter(s => !s._fromCloud).pop().cloudKey, day);
  await expect.poll(async () => !!(await adminGet(`sales/${day}/v/${key}`)), { timeout: 15_000 }).toBe(true);
  await page.evaluate((k) => { window._adminUnlocked = true; window._adminUnlockedUntil = Date.now() + 60000; cancelSale(k); }, key);
  await expect.poll(async () => !!(await adminGet(`sales/${day}/cancel/${key}`)), { timeout: 15_000 }).toBe(true);
  const orig = await adminGet(`sales/${day}/v/${key}`);
  expect(orig.fields.payType.stringValue).toBe('cash');
  expect(orig.fields.cancelled.booleanValue).toBe(false);
  const local = await page.evaluate(({ d, key }) => JSON.parse(localStorage.getItem('sales_' + d)).find(s => s.cloudKey === key), { d: day, key });
  expect(local.cancelled).toBe(true);
});

test('enregistrement des appareils puis protection : inconnu bloqué, client QR en lecture seule', async ({ page, browser }) => {
  await openCaisse(page);
  // La caisse s'enregistre, publie le menu et active la protection
  await page.evaluate(async (code) => { await window.__staff.ready(); await window.__staff.enroll(code, 'Caisse', 'caisse'); }, CODE);
  expect(await page.evaluate(() => window.__staff.status().isStaff)).toBe(true);
  await page.evaluate(() => { window._cloudMenuSeen = true; publishMenu(true); });
  await expect.poll(async () => !!(await adminGet('config/menu')), { timeout: 15_000 }).toBe(true);
  const menu = await adminGet('config/menu');
  expect(menu.fields.serveurPin).toBeUndefined();               // PIN plus dans le doc public
  // v84 : plus de PIN serveur → plus de config/staffcfg publié
  await page.evaluate(() => window.__staff.setEnforce(true));

  // Un autre appareil (contexte vierge) sur la cuisine → écran bloquant
  const ctx2 = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  await p2.goto('cuisine.html?emu', { waitUntil: 'domcontentloaded' });
  await expect(p2.getByText('Appareil non enregistré')).toBeVisible({ timeout: 20_000 });
  // Il ne peut ni lire les commandes ni écrire une vente
  const denied = await p2.evaluate(async () => {
    const m = await import('./assets/js/firebase-sync.js');
    await m.authReady;
    const out = {};
    try { await m.getDocs(m.collection(m.db, 'orders')); out.orders = 'lu'; } catch (e) { out.orders = e.code; }
    try { await m.setDoc(m.doc(m.db, 'config', 'menu'), { products: [] }); out.menu = 'écrit'; } catch (e) { out.menu = e.code; }
    return out;
  });
  expect(denied).toEqual({ orders: 'permission-denied', menu: 'permission-denied' });
  // Avec le code → débloqué
  await p2.getByPlaceholder("Code d'enregistrement").fill(CODE);
  await p2.getByRole('button', { name: 'Enregistrer' }).click();
  await p2.waitForLoadState('domcontentloaded');
  await expect(p2.getByText('Appareil non enregistré')).toHaveCount(0, { timeout: 20_000 });
  await ctx2.close();

  // Client QR (non enregistré) : voit la carte, ne peut plus commander (v84)
  const ctx3 = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block' });
  const p3 = await ctx3.newPage();
  await p3.goto('client.html?table=1&emu', { waitUntil: 'domcontentloaded' });
  const created = await p3.evaluate(async () => {
    const m = await import('./assets/js/firebase-sync.js');
    await m.authReady;
    try {
      await m.addDoc(m.collection(m.db, 'orders'), { tableId: 't1', tableNum: 1, status: 'pending', source: 'client', note: '',
        items: [{ pid: 'p8', name: 'x', qty: 1, price: 5 }], sentAt: m.serverTimestamp(), clientUid: m.auth.currentUser.uid });
      return 'ok';
    } catch (e) { return e.code; }
  });
  expect(created).toBe('permission-denied');
  await expect(p3.locator('button', { hasText: /Ajouter|Envoyer|Panier|Commander/ })).toHaveCount(0);
  expect(await p3.evaluate(() => typeof window.sendOrder)).toBe('undefined');
  await ctx3.close();
});

test('v84 : fonctions inutiles retirées de la caisse, réglages publiés seuls', async ({ page }) => {
  await adminSet('security/policy', { enforce: false });   // test d'interface, indépendant de la protection
  const errors = await openCaisse(page);
  const r = await page.evaluate(() => ({
    publier: [...document.querySelectorAll('button')].some(b => /Publier/.test(b.textContent)),
    exportPanel: !!document.getElementById('panel-export'),
    split: !!document.getElementById('split-section'),
    photoIA: !!document.getElementById('pm-ai-btn'),
    allergenesIA: !!document.getElementById('btn-suggest-allergens'),
    pdjIA: !!document.getElementById('pdj-btn-desc') || !!document.getElementById('pdj-btn-img'),
    mail: !!document.getElementById('s-mail-worker-url'),
    pinServeur: !!document.getElementById('s-serveur-pin'),
    tva: !!document.getElementById('s-tva'),
    stockModes: [...document.querySelectorAll('input[name=pm-stock-mode]')].map(i => i.value),
    fns: ['clearHistory', 'resetToDefault', 'exportData', 'sendReceiptByEmail', 'sendReceiptBySMS', 'suggestAllergensViaIA', 'changeSplit']
      .filter(f => typeof window[f] === 'function'),
  }));
  expect(r).toEqual({ publier: false, exportPanel: false, split: false, photoIA: false, allergenesIA: false, pdjIA: false,
    mail: false, pinServeur: false, tva: false, stockModes: ['unlimited', 'out'], fns: [] });
  // Un réglage modifié part tout seul (plus de bouton Publier) : saveSettings programme la publication
  const scheduled = await page.evaluate(() => { let n = 0; const o = window.scheduleAutoPublish;
    window.scheduleAutoPublish = () => { n++; }; try { saveSettings(); } finally { window.scheduleAutoPublish = o; } return n; });
  expect(scheduled).toBe(1);
  // Fiche produit : « Épuisé » / « Disponible » seulement
  const stock = await page.evaluate(() => { openEditProduct('p7'); document.querySelector('input[name=pm-stock-mode][value=out]').checked = true;
    return saveProduct().then(() => products.find(p => p.id === 'p7').stock); });
  expect(stock).toBe(0);
  await page.evaluate(() => { const p = products.find(x => x.id === 'p7'); p.stock = -1; saveAll(); });
  expect(errors.filter(e => !/\[SW\]|REST poll|permission|403/i.test(e))).toEqual([]);
});

for (const p of ['serveur.html', 'cuisine.html', 'client.html?table=1', 'client.html', 'ticket.html?id=ABCDEFGHJK', 'index.html', 'qrcodes.html']) {
  test(`chargement sans erreur JS : ${p}`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(p + (p.includes('?') ? '&' : '?') + 'emu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !/\[SW\]|REST poll|permission|403/i.test(e))).toEqual([]);
  });
}

test('cartes 2026 appliquées une fois : prix, nouveautés, retraits, cafés, ordre', async ({ page }) => {
  await openCaisse(page);
  const r = await page.evaluate(() => {
    const by = (id) => products.find(p => p.id === id);
    return {
      applied: JSON.parse(localStorage.getItem('carte_applied')),
      burger: by('p47') && [by('p47').name, by('p47').price],
      cote: by('p51').price,
      blonde33: by('p150') && [by('p150').price, by('p150').active, by('p150').section],
      escargots: by('p131') && by('p131').variants.map(v => v.label + ':' + v.price).join('|'),
      carpaccio: by('p40') ? by('p40').active : 'absent',
      cafe: by('p140') && [by('p140').cat, by('p140').price, by('p140').tva],
      cafes: cats.find(c => c.id === 'cafes'),
      firstDrinks: products.filter(p => p.cat === 'softs' && p.active).slice(0, 3).map(p => p.name),
      count: products.filter(p => p.active).length
    };
  });
  expect(r.applied).toBe('2026-11');
  expect(r.burger).toEqual(['Le burger maison', 17.5]);
  expect(r.cote).toBe(70);
  expect(r.blonde33).toEqual([5.5, true, 'Bières pression']);
  expect(r.escargots).toBe('6 pièces:12|12 pièces:18');
  expect(r.carpaccio === false || r.carpaccio === 'absent').toBe(true);
  expect(r.cafe).toEqual(['cafes', 1.9, 10]);
  expect(r.cafes.noCuisine).toBe(true);
  expect(r.firstDrinks).toEqual(['Sodas', 'Sirops', 'Jus']);
  // Photos produits : chemins relatifs du site acceptés, schémas dangereux refusés
  const urls = await page.evaluate(() => [safeImg('images/soda.png'), safeImg('./assets/x.webp'), safeImg('javascript:alert(1)'),
    safeImg('//evil.example/x.png'), safeImg('data:image/svg+xml;base64,AAAA'), safeImg('https://firebasestorage.googleapis.com/x.jpg')]);
  expect(urls).toEqual(['images/soda.png', './assets/x.webp', '', '', '', 'https://firebasestorage.googleapis.com/x.jpg']);
  // v83 : le menu est rendu pendant le parsing, avant le module firebase-sync.
  // safeImg ne doit donc PAS dépendre de window.__safe (sinon 🍽️ partout au démarrage).
  const bootImg = await page.evaluate(() => { const s = window.__safe; window.__safe = undefined;
    try { return safeImg('images/soda.png'); } finally { window.__safe = s; } });
  expect(bootImg).toBe('images/soda.png');
  await page.evaluate(() => { currentCat = 'softs'; settings.showImg = true; renderMenu(); });
  expect(await page.locator('.mcard-img img').count()).toBeGreaterThan(3);
  // v85 : photos servies en WebP optimisé (≈27 Ko) au lieu des PNG de 2 à 7 Mo, et réellement chargées
  expect(await page.evaluate(() => [optImg('images/soda.png', 'thumb'), optImg('./images/a b.png'), optImg('https://x.example/y.png'), optImg('data:image/png;base64,AA')]))
    .toEqual(['images/optimized/soda-thumb.webp', './images/a b.png', 'https://x.example/y.png', 'data:image/png;base64,AA']);
  const srcs = await page.locator('.mcard-img img').evaluateAll((els) => els.map((i) => i.getAttribute('src')));
  expect(srcs.filter((s) => /^images\/[^/]+\.(png|jpe?g)$/i.test(s))).toEqual([]);
  await page.waitForFunction(() => [...document.querySelectorAll('.mcard-img img')].every((i) => i.complete), null, { timeout: 15_000 });
  expect(await page.locator('.mcard-img img').evaluateAll((els) => els.filter((i) => !i.naturalWidth).map((i) => i.src))).toEqual([]);
  // Chaque photo du site a ses trois versions optimisées (sinon optImg pointerait dans le vide)
  const fs = await import('node:fs');
  const dir = new URL('../images/', import.meta.url);
  const missing = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).flatMap((f) => ['thumb', 'medium', 'full']
    .map((sz) => `optimized/${f.replace(/\.[^.]+$/, '')}-${sz}.webp`)).filter((p) => !fs.existsSync(new URL(p, dir)));
  expect(missing).toEqual([]);
  // Pas de bouton « 86 » sur les produits disponibles (pris pour un compteur de stock)
  expect(await page.locator('.mcard-86').count()).toBe(0);
  await page.evaluate(() => { products.find(p => p.id === 'p7').stock = 0; renderMenu(); });
  expect(await page.locator('.mcard-86').count()).toBe(1);   // ✓ « remettre dispo » seulement si épuisé
  await page.evaluate(() => { products.find(p => p.id === 'p7').stock = undefined; renderMenu(); });
  // Rejouée au rechargement ? Non (une seule fois) : un prix modifié à la main reste
  await page.evaluate(() => { products.find(p => p.id === 'p47').price = 18; saveAll(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.FB && window.FB.getCol), null, { timeout: 45_000 });
  expect(await page.evaluate(() => products.find(p => p.id === 'p47').price)).toBe(18);
  // Encaissement d'un café : bon prix, catégorie hors cuisine
  await page.evaluate(() => { addToTicketDirect('p140'); openPay(); selectPayType('cash'); validatePay(); });
  const day = await page.evaluate(() => serviceDayKey());
  const last = await page.evaluate((d) => JSON.parse(localStorage.getItem('sales_' + d)).filter(s => !s._fromCloud).pop(), day);
  expect([last.total, last.payType, last.items[0].name]).toEqual([1.9, 'cash', 'Café']);
});

// ── Test à blanc v84 : le circuit réel du resto (serveuse → cuisine → serveuse) ──
const decode = (v) => {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  return v;
};

async function openEnrolled(browser, url) {
  const ctx = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errors = collectConsoleErrors(pg);
  pg.on('dialog', (d) => d.accept());
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !!window.__staff, null, { timeout: 45_000 });
  await pg.evaluate(async (code) => { await window.__staff.ready(); await window.__staff.enroll(code, 'Test', 'test'); }, CODE);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !!(window.__staff && window.__staff.status().isStaff), null, { timeout: 45_000 });
  return { ctx, pg, errors };
}

test('test à blanc : serveuse → cuisine → « prête » ; panier gardé par table ; annulation', async ({ browser }) => {
  await adminSet('security/policy', { enforce: true });    // conditions réelles : protection active, appareils enregistrés
  const m = decode({ mapValue: { fields: (await adminGet('config/menu')).fields } });
  const noCuisine = new Set((m.cats || []).filter((c) => c.noCuisine).map((c) => c.id));
  const plat = (m.products || []).find((p) => p.active !== false && !noCuisine.has(p.cat) && !p.hasCuisson && !p.hasGarniture
    && !p.hasSirop && !(Array.isArray(p.variants) ? p.variants.length : p.variants));
  expect(plat, 'un plat sans option pour la cuisine').toBeTruthy();

  // Serveuse (téléphone enregistré) à la table 5
  const S = await openEnrolled(browser, 'serveur.html?table=5&id=t5&emu');
  await S.pg.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', null, { timeout: 30_000 });
  await S.pg.evaluate((pid) => window.addProduct(pid), plat.id);
  await expect(S.pg.locator('#cart-count')).toContainText('1');
  // Passer à la table 6 puis revenir : le panier de la 5 n'est pas perdu
  await S.pg.evaluate(() => window.pickTable('t6', '6'));
  await expect(S.pg.locator('#cart-count')).toContainText('0');
  await S.pg.evaluate(() => window.pickTable('t5', '5'));
  await expect(S.pg.locator('#cart-count')).toContainText('1');
  await S.pg.evaluate(() => window.sendOrder());

  let order;
  await expect.poll(async () => {
    const docs = (await adminList('orders')).map((d) => ({ id: d.name.split('/').pop(), ...decode({ mapValue: { fields: d.fields } }) }));
    order = docs.find((o) => o.tableId === 't5' && o.source === 'serveur');
    return order && order.status;
  }, { timeout: 20_000 }).toBe('pending');
  expect(order.items.map((i) => i.pid)).toEqual([plat.id]);
  await expect(S.pg.locator('#cart-count')).toContainText('0');   // panier vidé après envoi réussi

  // Cuisine (tablette enregistrée) : la commande arrive, on la fait avancer
  const K = await openEnrolled(browser, 'cuisine.html?emu');
  const btn = (act) => K.pg.locator(`button[data-act="${act}"][data-id="${order.id}"]`);
  await expect(btn('preparing')).toBeVisible({ timeout: 30_000 });
  await btn('preparing').click();
  await expect.poll(async () => decode((await adminGet('orders/' + order.id)).fields.status), { timeout: 15_000 }).toBe('preparing');
  await btn('ready').click();
  await expect.poll(async () => decode((await adminGet('orders/' + order.id)).fields.status), { timeout: 15_000 }).toBe('ready');
  // La serveuse est prévenue
  await expect(S.pg.getByText(/prête/i).first()).toBeVisible({ timeout: 20_000 });
  // « Annuler » (anciennement ✕) : libellé explicite, commande annulée
  await expect(btn('clear')).toHaveText(/Annuler/);
  await btn('clear').click();
  await expect.poll(async () => decode((await adminGet('orders/' + order.id)).fields.status), { timeout: 15_000 }).toBe('cancelled');

  const noise = (e) => /\[SW\]|REST poll|permission|403|Notification/i.test(e);
  expect(S.errors.filter((e) => !noise(e))).toEqual([]);
  expect(K.errors.filter((e) => !noise(e))).toEqual([]);
  await S.ctx.close(); await K.ctx.close();
});

test('v86 : plan de salle réel — dimensions libres, ovales, tables inclinées (caisse + serveuse)', async ({ page, browser }) => {
  await adminSet('security/policy', { enforce: false });
  const fs = await import('node:fs');
  const plan = JSON.parse(fs.readFileSync(new URL('../scripts/plan-salle-2026.json', import.meta.url), 'utf8'));
  await page.setViewportSize({ width: 1280, height: 720 });
  await openCaisse(page);
  // Le plan arrive par le cloud (comme avec scripts/apply-plan-salle.mjs) et la caisse le reprend
  await page.evaluate((p) => window.FB.setMerge('config', 'menu', { salleLayout: p }), plan);
  await page.waitForFunction((n) => (window.salleElements || []).length === n, plan.length, { timeout: 20_000 });
  await page.evaluate(() => openSalle());
  const r = await page.evaluate(() => {
    const q = (id) => document.querySelector(`#salle-elements [data-id="${id}"]`);
    const t69 = q('t69'), t7 = q('t7'), t18 = q('t18');
    return {
      n: document.querySelectorAll('#salle-elements [data-id]').length,
      t69: [t69.style.width, t69.style.height, t69.style.borderRadius],
      t18: [t18.style.width, t18.style.height],
      t7: [t7.style.transform, [...t7.children].find((c) => c.textContent.trim() === '7').style.transform],
      door: !!q('door1') && q('door1').textContent.includes('Entrée'),
    };
  });
  expect(r).toEqual({ n: plan.length, t69: ['327px', '143px', '50%'], t18: ['108px', '207px'],
    t7: ['rotate(-20deg)', 'rotate(20deg)'], door: true });
  if (process.env.SHOT_DIR) { await page.evaluate(() => { const p = document.getElementById('pin-screen'); if (p) p.style.display = 'none'; });
    await page.screenshot({ path: process.env.SHOT_DIR + '/plan-caisse.png' }); }

  // Téléphone serveuse : même plan, 19 tables touchables
  const ctx = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block', viewport: { width: 900, height: 560 } });
  const s = await ctx.newPage();
  await s.goto('serveur.html?emu', { waitUntil: 'domcontentloaded' });
  await expect(s.locator('#plan-inner [data-tidx]')).toHaveCount(19, { timeout: 30_000 });
  if (process.env.SHOT_DIR) await s.screenshot({ path: process.env.SHOT_DIR + '/plan-serveur.png' });
  await s.locator('#plan-inner [data-tidx]').filter({ hasText: /^\s*69\b/ }).click();
  await expect(s.locator('#app')).toBeVisible();
  await ctx.close();
});
