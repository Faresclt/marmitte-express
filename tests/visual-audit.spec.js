// Audit visuel : capture chaque écran de l'app sur plusieurs appareils (émulateurs
// Firebase, aucune donnée de prod) + mesures automatiques (débordements, textes
// coupés, cibles tactiles trop petites, texte minuscule).
// Lancer depuis la racine du repo :
//   set AUDIT_OUT=<dossier> && firebase emulators:exec --only firestore,auth --project la-marmitte-express "npx --prefix tests playwright test -c tests/playwright.visual.config.js"
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const EMU = 'http://127.0.0.1:8085/v1/projects/la-marmitte-express/databases/(default)/documents';
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const CODE = 'CODE-TEST-1234';
const OUT = process.env.AUDIT_OUT || path.resolve('test-results/visual-audit');
const ONLY = process.env.AUDIT_ONLY ? process.env.AUDIT_ONLY.split(',') : null;   // ex. tel-360,tab-paysage

const VIEWPORTS = [
  { name: 'tel-360', viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },        // Android courant
  { name: 'tel-390', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },        // iPhone 12-16
  { name: 'tab-portrait', viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },  // tablette 10" debout
  { name: 'tab-paysage', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },   // tablette 10" couchée
].filter((v) => !ONLY || ONLY.includes(v.name));

async function adminSet(p, fields) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) =>
    [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }])) };
  const r = await fetch(`${EMU}/${p}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('adminSet ' + p + ' ' + r.status);
}
async function adminGet(p) { const r = await fetch(`${EMU}/${p}`, { headers: ADMIN }); return r.ok ? r.json() : null; }
const decode = (v) => {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  return v;
};

async function newDevice(browser, vp, url, enroll) {
  const ctx = await browser.newContext({ bypassCSP: true, serviceWorkers: 'block', locale: 'fr-FR',
    viewport: vp.viewport, deviceScaleFactor: vp.deviceScaleFactor, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  pg.on('dialog', (d) => d.accept());
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  if (enroll) {
    await pg.waitForFunction(() => !!window.__staff, null, { timeout: 45_000 });
    await pg.evaluate(async (code) => { await window.__staff.ready(); await window.__staff.enroll(code, 'Audit', 'audit'); }, CODE);
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => !!(window.__staff && window.__staff.status().isStaff), null, { timeout: 45_000 });
  }
  return { ctx, pg, errors };
}

// Mesures DOM sur ce qui est visible à l'écran
function measure() {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const sel = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; else if (el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.'); const p = el.parentElement; if (!el.id && p) s = (p.id ? '#' + p.id : p.tagName.toLowerCase() + (p.classList[0] ? '.' + p.classList[0] : '')) + ' > ' + s; return s; };
  const clipX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
  const inView = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  const all = [...document.querySelectorAll('body *')].filter(vis);
  const txt = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const overflowRight = all.filter((el) => { const r = el.getBoundingClientRect(); return r.right > W + 2 && r.left < W && !clipX(el) && getComputedStyle(el).position !== 'fixed'; })
    .slice(0, 15).map((el) => ({ sel: sel(el), left: Math.round(el.getBoundingClientRect().left), right: Math.round(el.getBoundingClientRect().right), text: txt(el) }));
  const clickable = all.filter((el) => el.matches('button,a[href],input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[onclick],[role=button],label.toggle,[data-action]'));
  const smallTargets = clickable.filter((el) => { const r = el.getBoundingClientRect(); return inView(r) && (r.width < 36 || r.height < 36); })
    .slice(0, 30).map((el) => { const r = el.getBoundingClientRect(); return { sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), text: txt(el) }; });
  const truncated = all.filter((el) => { const s = getComputedStyle(el); if (!(s.textOverflow === 'ellipsis' || s.overflow === 'hidden' || s.overflowX === 'hidden')) return false; return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && (el.innerText || '').trim().length > 0 && inView(el.getBoundingClientRect()); })
    .slice(0, 20).map((el) => ({ sel: sel(el), text: txt(el), sw: el.scrollWidth, cw: el.clientWidth }));
  const tiny = [];
  for (const el of all) {
    if (tiny.length >= 20) break;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 11 && inView(el.getBoundingClientRect())) tiny.push({ sel: sel(el), fs, text: txt(el) });
  }
  const scrollW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  return { W, H, scrollW, horizontalScroll: scrollW > W + 2, overflowRight, smallTargets, truncated, tiny };
}

const report = [];
async function shot(dev, vp, name, opts = {}) {
  await dev.pg.waitForTimeout(opts.wait ?? 700);
  const dir = path.join(OUT, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name + '.png');
  await dev.pg.screenshot({ path: file, fullPage: !!opts.fullPage });
  const m = await dev.pg.evaluate(measure);
  report.push({ viewport: vp.name, screen: name, file: path.relative(OUT, file).replace(/\\/g, '/'), ...m, errors: dev.errors.slice(0, 5) });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(600_000);

let ids = {};
test.beforeAll(async () => {
  await fetch('http://127.0.0.1:8085/emulator/v1/projects/la-marmitte-express/databases/(default)/documents', { method: 'DELETE' });
  await adminSet('security/enroll', { code: CODE });
  await adminSet('security/policy', { enforce: true });
});

test.afterAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'mesures.json'), JSON.stringify(report, null, 1));
});

test('données du service : carte publiée, plan de salle, plat du jour, deux commandes', async ({ browser }) => {
  const vp = { name: 'seed', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
  const C = await newDevice(browser, vp, 'marmite-express-caisse.html?emu', true);
  await C.pg.evaluate(() => { LS.set('pdjDailyShown', new Date().toDateString()); });
  await C.pg.waitForFunction(() => !!(window.FB && window.FB.setMerge), null, { timeout: 45_000 });
  await C.pg.evaluate(() => publishMenu(false));
  await expect.poll(async () => !!(await adminGet('config/menu')), { timeout: 30_000 }).toBe(true);
  const plan = JSON.parse(fs.readFileSync(new URL('../scripts/plan-salle-2026.json', import.meta.url), 'utf8'));
  await C.pg.evaluate((p) => window.FB.setMerge('config', 'menu', { salleLayout: p }), plan);
  await C.pg.waitForFunction(() => window._cloudMenuSeen === true && (window.salleElements || []).some((e) => e.id === 't5'), null, { timeout: 30_000 });
  // Plat du jour saisi comme le ferait la patronne
  await C.pg.evaluate(() => { document.getElementById('pin-screen').style.display = 'none'; showAdmin(); showPanel('products'); openPdjModal(); });
  await C.pg.fill('#pdj-nom', 'Rougail saucisses');
  await C.pg.fill('#pdj-prix', '15,90');
  await C.pg.fill('#pdj-desc', 'Saucisses fumées, tomates, piment doux, riz blanc');
  await C.pg.locator('#pdj-modal .mbtn-save').click();
  await expect.poll(async () => {
    const m = decode({ mapValue: { fields: (await adminGet('config/menu')).fields } });
    return (m.products || []).find((p) => p.pdj)?.price;
  }, { timeout: 20_000 }).toBe(15.9);
  const m = decode({ mapValue: { fields: (await adminGet('config/menu')).fields } });
  const find = (re) => (m.products || []).find((x) => re.test(x.name));
  ids = { entrecote: find(/entrecôte/i)?.id, burger: find(/^Le burger maison$/)?.id, blonde: find(/^Blonde 50cl$/)?.id, pdj: (m.products || []).find((p) => p.pdj)?.id, cafe: find(/^Café$/)?.id };
  // Deux tables servies par la serveuse
  const S = await newDevice(browser, vp, 'serveur.html?table=5&id=t5&emu', true);
  await S.pg.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', null, { timeout: 30_000 });
  const send = async () => { await S.pg.locator('#cart-bar').click(); await S.pg.getByRole('button', { name: /Confirmer la commande/ }).click(); await S.pg.waitForTimeout(1500); };
  await S.pg.evaluate((id) => addProduct(id), ids.pdj);
  await S.pg.evaluate((id) => addProduct(id), ids.pdj);
  await S.pg.evaluate((id) => addProduct(id), ids.burger);
  if (await S.pg.locator('#opt-modal.show, #opt-modal.open').count()) await S.pg.locator('#opt-modal button', { hasText: 'Ajouter' }).click();
  await send();
  await S.pg.goto('serveur.html?table=3&id=t3&emu', { waitUntil: 'domcontentloaded' });
  await S.pg.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', null, { timeout: 30_000 });
  await S.pg.evaluate((id) => addProduct(id), ids.entrecote);
  await S.pg.locator('#opt-cuisson-btns .opt-chip', { hasText: 'Saignant' }).click();
  await S.pg.locator('#opt-modal button', { hasText: 'Ajouter' }).click();
  await S.pg.evaluate((id) => addProduct(id), ids.cafe);
  await send();
  await C.pg.waitForFunction(() => ((window.tableData || {}).t5?.ticket || []).length >= 2 && ((window.tableData || {}).t3?.ticket || []).length >= 1, null, { timeout: 40_000 });
  await C.ctx.close(); await S.ctx.close();
});

for (const vp of VIEWPORTS) {
  test(`captures ${vp.name}`, async ({ browser }) => {
    // Accueil
    const I = await newDevice(browser, vp, 'index.html', false);
    await shot(I, vp, 'accueil', { wait: 1200, fullPage: true });
    await I.ctx.close();

    // Carte client (QR)
    const Q = await newDevice(browser, vp, 'client.html?table=5&emu', false);
    await Q.pg.locator('.prod-card').first().waitFor({ timeout: 30_000 });
    await shot(Q, vp, 'client-carte', { wait: 1500 });
    await shot(Q, vp, 'client-carte-complete', { fullPage: true, wait: 300 });
    await Q.pg.locator('.prod-card.has-img').first().click();
    await shot(Q, vp, 'client-fiche-produit', { wait: 900 });
    await Q.ctx.close();

    // Téléphone serveuse
    const S = await newDevice(browser, vp, 'serveur.html?emu', true);
    await S.pg.waitForTimeout(2500);
    await shot(S, vp, 'serveuse-choix-table', { wait: 500 });
    await S.pg.goto('serveur.html?table=5&id=t5&emu', { waitUntil: 'domcontentloaded' });
    await S.pg.waitForFunction(() => getComputedStyle(document.getElementById('app')).display !== 'none', null, { timeout: 30_000 });
    await shot(S, vp, 'serveuse-carte', { wait: 1500 });
    await S.pg.evaluate((id) => addProduct(id), ids.entrecote);
    await shot(S, vp, 'serveuse-options', { wait: 600 });
    await S.pg.locator('#opt-cuisson-btns .opt-chip').first().click();
    await S.pg.locator('#opt-modal button', { hasText: 'Ajouter' }).click();
    await S.pg.evaluate((id) => { addProduct(id); addProduct(id); }, ids.pdj);
    await shot(S, vp, 'serveuse-carte-avec-panier', { wait: 600 });
    await S.pg.locator('#cart-bar').click();
    await shot(S, vp, 'serveuse-panier', { wait: 700 });
    await S.ctx.close();

    // Écran cuisine
    const K = await newDevice(browser, vp, 'cuisine.html?emu', true);
    await K.pg.waitForTimeout(4000);
    await shot(K, vp, 'cuisine', { wait: 300 });
    await K.ctx.close();

    // Tablette caisse
    const C = await newDevice(browser, vp, 'marmite-express-caisse.html?emu', true);
    await shot(C, vp, 'caisse-code-pin', { wait: 1500 });
    await C.pg.evaluate(() => { pinEntry = '1234'; checkPin(); });
    await C.pg.waitForTimeout(4200);   // popup « Plat du jour » de la 1re ouverture du jour
    await shot(C, vp, 'caisse-popup-plat-du-jour', { wait: 300 });
    await C.pg.evaluate(() => closePdjDaily());
    await C.pg.waitForFunction(() => ((window.tableData || {}).t5?.ticket || []).length >= 2, null, { timeout: 40_000 });
    await C.pg.evaluate(() => openSalle());
    await shot(C, vp, 'caisse-plan-de-salle', { wait: 1200 });
    await C.pg.evaluate(() => openTableService('t5'));
    await shot(C, vp, 'caisse-addition-table', { wait: 900 });
    await C.pg.evaluate(() => goToPOSForTable());
    await shot(C, vp, 'caisse-prise-de-commande', { wait: 1200 });
    await C.pg.evaluate(() => { showAdmin(); showPanel('products'); });
    await shot(C, vp, 'caisse-admin-produits', { wait: 800 });
    await C.pg.evaluate(() => openPdjModal());
    await shot(C, vp, 'caisse-fenetre-plat-du-jour', { wait: 600 });
    await C.pg.evaluate(() => { closePdjModal(); showPanel('settings'); });
    await shot(C, vp, 'caisse-admin-parametres', { wait: 600 });
    await C.ctx.close();

    if (vp.viewport.width >= 800) {
      const R = await newDevice(browser, vp, 'qrcodes.html?emu', false);
      await shot(R, vp, 'qrcodes', { wait: 2500 });
      await R.ctx.close();
    }
  });
}
