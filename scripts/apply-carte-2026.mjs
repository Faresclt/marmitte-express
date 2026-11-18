// Applique les cartes 2026 (assets/js/carte-2026.js) au menu CLOUD (config/menu),
// pour que la carte QR et les téléphones serveuses les voient tout de suite.
// La caisse applique la même carte à son menu local (applyCarte2026) puis republie.
//
//   node scripts/apply-carte-2026.mjs          → simulation (aucune écriture)
//   node scripts/apply-carte-2026.mjs --write  → écrit config/menu (products + cats)
//
// Accès : refresh token firebase-tools (compte propriétaire). Sauvegarde de
// l'ancien menu écrite à côté avant toute écriture.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');
const ctx = { globalThis: {} }; ctx.window = ctx.globalThis;
vm.runInNewContext(readFileSync(join(here, '..', 'assets', 'js', 'carte-2026.js'), 'utf8'), ctx);
const C = ctx.globalThis.CARTE_2026;

const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const tokRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi' }) });
const { access_token } = await tokRes.json();
const H = { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' };
const URL_MENU = 'https://firestore.googleapis.com/v1/projects/la-marmitte-express/databases/(default)/documents/config/menu';

// ── conversion format REST typé ⇄ JS ──
const dec = (v) => {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  return null;
};
const enc = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)])) } };
};

const doc = await (await fetch(URL_MENU, { headers: H })).json();
if (!doc.fields) throw new Error('config/menu illisible');
const menu = Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, dec(v)]));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = join(here, `menu-cloud-avant-carte-2026_${stamp}.json`);

const now = Date.now();
const cats = [...(menu.cats || [])];
(C.newCats || []).forEach((nc) => {
  if (cats.some((c) => c.id === nc.id)) return;
  const c = { id: nc.id, name: nc.name, icon: nc.icon, noCuisine: !!nc.noCuisine };
  const i = cats.findIndex((x) => x.id === nc.after);
  i >= 0 ? cats.splice(i + 1, 0, c) : cats.push(c);
});
const byId = new Map((menu.products || []).map((p) => [p.id, p]));
const ordered = [];
const log = { maj: [], crees: [], retires: [], prix: [] };
for (const it of C.items) {
  let p = byId.get(it.id);
  if (it.keep) { if (p) { if (it.cat) p.cat = it.cat; if (it.section) p.section = it.section; ordered.push(p); } continue; }
  if (!p) {
    const src = it.img && byId.get(it.img);
    p = { id: it.id, tva: it.cat === 'alcools' ? 20 : 10, stock: -1, imgUrl: (src && src.imgUrl) || null, pdj: false,
      hasCuisson: false, hasGarniture: false, hasVariant: false, hasSirop: false, variants: null,
      description: '', garniture: '', sauces: '', allergens: [], vegetarian: false, vegan: false, glutenFree: false, spicy: false, alcohol: it.cat === 'alcools' };
    log.crees.push(`${it.id} ${it.name} ${it.price} €`);
  } else {
    if (p.price !== it.price) log.prix.push(`${it.id} ${p.name} : ${p.price} → ${it.price} €`);
    if (p.name !== it.name) log.maj.push(`${it.id} « ${p.name} » → « ${it.name} »`);
  }
  Object.assign(p, { cat: it.cat, section: it.section, name: it.name, sub: it.sub || '', price: it.price, updatedAt: now });
  if ('hasVariant' in it) { p.hasVariant = !!it.hasVariant; p.variants = it.variants || null; }
  if ('hasSirop' in it) p.hasSirop = !!it.hasSirop;
  ordered.push(p);
}
const inCarte = new Set(ordered.map((p) => p.id));
const retireSet = new Set(C.retire || []);
for (const p of menu.products || []) {
  if (inCarte.has(p.id)) continue;
  if (retireSet.has(p.id)) { log.retires.push(`${p.id} ${p.name}`); continue; }
  ordered.push(p); // produit hors carte non listé : conservé tel quel
}
// Catégories : garder seulement celles qui ont des produits
const usedCats = new Set(ordered.map((p) => p.cat));
const finalCats = cats.filter((c) => usedCats.has(c.id));

console.log(`Produits : ${menu.products.length} → ${ordered.length}`);
console.log(`Catégories : ${(menu.cats || []).map((c) => c.id).join(',')} → ${finalCats.map((c) => c.id).join(',')}`);
console.log(`\nPrix modifiés (${log.prix.length}) :\n  ` + log.prix.join('\n  '));
console.log(`\nRenommés (${log.maj.length}) :\n  ` + log.maj.join('\n  '));
console.log(`\nCréés (${log.crees.length}) :\n  ` + log.crees.join('\n  '));
console.log(`\nRetirés de la carte publiée (${log.retires.length}) :\n  ` + log.retires.join('\n  '));
const hors = ordered.filter((p) => !inCarte.has(p.id)).map((p) => `${p.id} ${p.name}`);
if (hors.length) console.log(`\nHors carte, conservés (${hors.length}) :\n  ` + hors.join('\n  '));

if (!WRITE) { console.log('\n(simulation — relancer avec --write pour écrire)'); process.exit(0); }
writeFileSync(backupPath, JSON.stringify(doc, null, 1));
const body = { fields: { products: enc(ordered), cats: enc(finalCats) } };
const res = await fetch(`${URL_MENU}?updateMask.fieldPaths=products&updateMask.fieldPaths=cats`, { method: 'PATCH', headers: H, body: JSON.stringify(body) });
if (!res.ok) throw new Error('écriture refusée : ' + res.status + ' ' + (await res.text()).slice(0, 300));
console.log(`\n✔ config/menu mis à jour (sauvegarde : ${backupPath})`);
