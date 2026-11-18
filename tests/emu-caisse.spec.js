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
  expect(main.price).toBe(3.5);                    // prix du menu, pas 0,01
  expect(main.name).toBe('St Pellegrino 50cl');    // nom du menu, pas le HTML piégé
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

test('enregistrement des appareils puis protection : inconnu bloqué, client QR OK', async ({ page, browser }) => {
  await openCaisse(page);
  // La caisse s'enregistre, publie le menu et active la protection
  await page.evaluate(async (code) => { await window.__staff.ready(); await window.__staff.enroll(code, 'Caisse', 'caisse'); }, CODE);
  expect(await page.evaluate(() => window.__staff.status().isStaff)).toBe(true);
  await page.evaluate(() => { window._cloudMenuSeen = true; publishMenu(true); });
  await expect.poll(async () => !!(await adminGet('config/menu')), { timeout: 15_000 }).toBe(true);
  const menu = await adminGet('config/menu');
  expect(menu.fields.serveurPin).toBeUndefined();               // PIN plus dans le doc public
  await expect.poll(async () => !!(await adminGet('config/staffcfg')), { timeout: 15_000 }).toBe(true);
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

  // Client QR (non enregistré) : peut toujours commander
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
  expect(created).toBe('ok');
  await ctx3.close();
});

for (const p of ['serveur.html', 'cuisine.html', 'client.html?table=1', 'ticket.html?id=ABCDEFGHJK', 'index.html', 'qrcodes.html', 'setup-images.html']) {
  test(`chargement sans erreur JS : ${p}`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto(p + (p.includes('?') ? '&' : '?') + 'emu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !/\[SW\]|REST poll|permission|403/i.test(e))).toEqual([]);
  });
}
