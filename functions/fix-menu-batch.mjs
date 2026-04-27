// Batch fix menu vs PDF :
// 1. Ajoute items manquants (Bavette, Piscine de Rosé, Jet 31, Salade fruits, Blanc manger, Rouge 25cl)
// 2. Corrige prix incorrects (Clan Campbell, Jack Daniel's, Campari, etc.)
// 3. Reset imgUrl sur les vins (bout.) — re-genere via Pollinations avec prompt "bouteille"
//    pour que photo bouteille != photo verre.
//
// Idempotent : ne re-ajoute pas si id deja present.

import fs from 'fs';
import path from 'path';
import os from 'os';

const PROJECT = 'la-marmitte-express';
const DRY = process.argv.includes('--dry-run');

const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
const r1 = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: cfg.tokens.refresh_token,
    grant_type: 'refresh_token'
  })
});
const TOKEN = (await r1.json()).access_token;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const r2 = await fetch(`${BASE}/config/menu`, { headers: { Authorization: 'Bearer ' + TOKEN } });
const doc = await r2.json();
const products = doc.fields.products.arrayValue.values;

// ── Index par id ──
const byId = {};
products.forEach(p => { byId[p.mapValue.fields.id?.stringValue] = p.mapValue.fields; });

// ── 1. ITEMS MANQUANTS ──
const missing = [
  { id: 'p120', cat: 'plats', name: "Bavette à l'échalotte", price: 15, sub: "Garniture au choix",
    description: "Bavette de bœuf grillée, sauce à l'échalotte confite. Garniture au choix.",
    garniture: "Au choix : pommes de terre sautées, salade, pâtes ou frites maison",
    hasGarniture: true, hasCuisson: true },
  { id: 'p121', cat: 'desserts', name: "Salade de Fruits Frais", price: 8,
    description: "Salade de fruits frais de saison, légèrement sucrée et citronnée.",
    vegan: true, glutenFree: true },
  { id: 'p122', cat: 'desserts', name: "Blanc Manger Coco", price: 7,
    description: "Blanc manger à la noix de coco, lait de coco et vanille bourbon.",
    allergens: ['Lait', 'Fruits à coque (coco)'], vegetarian: true, glutenFree: true },
  { id: 'p123', cat: 'cocktails', name: "Piscine de Rosé", price: 5,
    description: "Verre de rosé bien frais avec glaçons, façon piscine. Idéal apéritif.",
    alcohol: true, glutenFree: true, allergens: ['Sulfites'] },
  { id: 'p124', cat: 'alcools', name: "Get 31 (Vert)", price: 6,
    description: "Liqueur de menthe glaciale Get 31. Servi sur glace.",
    alcohol: true, glutenFree: true },
  { id: 'p125', cat: 'alcools', name: "Rouge 25cl", price: 5,
    description: "Bière rouge pression — 25cl.",
    alcohol: true, allergens: ['Gluten'], hasGarniture: false }
];

let added = 0;
missing.forEach(m => {
  if (byId[m.id]) { console.log(`✓ ${m.id} ${m.name} déjà présent (skip).`); return; }
  // Trouve TVA par cat
  const tva = (m.cat === 'plats' || m.cat === 'salades' || m.cat === 'entrees' || m.cat === 'desserts') ? 10 : 20;
  const fields = {
    id: { stringValue: m.id },
    cat: { stringValue: m.cat },
    name: { stringValue: m.name },
    price: { doubleValue: m.price },
    tva: { integerValue: tva }
  };
  if (m.sub) fields.sub = { stringValue: m.sub };
  if (m.description) fields.description = { stringValue: m.description };
  if (m.garniture) fields.garniture = { stringValue: m.garniture };
  if (m.hasGarniture) fields.hasGarniture = { booleanValue: true };
  if (m.hasCuisson) fields.hasCuisson = { booleanValue: true };
  if (m.vegetarian) fields.vegetarian = { booleanValue: true };
  if (m.vegan) fields.vegan = { booleanValue: true };
  if (m.glutenFree) fields.glutenFree = { booleanValue: true };
  if (m.alcohol) fields.alcohol = { booleanValue: true };
  if (m.allergens) fields.allergens = { arrayValue: { values: m.allergens.map(a => ({ stringValue: a })) } };
  products.push({ mapValue: { fields } });
  byId[m.id] = fields;
  added++;
  console.log(`+ ${m.id} ${m.name} ${m.price}€ ajouté`);
});

// ── 2. PRIX INCORRECTS ──
const priceFixes = {
  p94: 6,    // Clan Campbell 7 → 6
  p93: 7,    // Jack Daniel's 8 → 7
  p69: 4,    // Campari 5 → 4
  p68: 7.5,  // Americano 6 → 7.5
  p85: 8,    // Curaçao 6 → 8
  p88: 8,    // Calvados 7 → 8
  p91: 8,    // Rhum Ambré 7 → 8
  p83: 8,    // Bailey's 7 → 8
  p84: 8,    // Cointreau 7 → 8
  p87: 6,    // Poire Williams 7 → 6
  p82: 6     // Get 27 ok already 6
};

let fixed = 0;
Object.entries(priceFixes).forEach(([id, price]) => {
  const f = byId[id];
  if (!f) return;
  const cur = f.price?.doubleValue ?? f.price?.integerValue;
  if (cur === price) return;
  f.price = { doubleValue: price };
  fixed++;
  console.log(`~ ${id} ${f.name?.stringValue} : ${cur}€ → ${price}€`);
});

// ── 3. PHOTOS VINS BOUTEILLE — reset à Pollinations bottle prompt ──
function pollinationsUrl(prompt) {
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
         '?width=1024&height=1024&nologo=true&model=flux&seed=' + Math.floor(Math.random() * 1e9);
}

const wineBottles = products.filter(p => {
  const n = p.mapValue.fields.name?.stringValue || '';
  return n.includes('(bout.)') || n.includes('(bouteille)') || n.endsWith('(bout)');
});

let imgFixed = 0;
wineBottles.forEach(p => {
  const f = p.mapValue.fields;
  const name = f.name?.stringValue || '';
  // Detect type pour prompt
  let wineType = 'red wine';
  if (/blanc|chardonnay|jasnière|jasniere|chablis/i.test(name)) wineType = 'white wine';
  else if (/rosé|rose|iles de beauté|montagne blanche|cabernet|provence/i.test(name)) wineType = 'rosé wine';
  else if (/champagne/i.test(name)) wineType = 'champagne';
  else if (/vouvray|brut/i.test(name)) wineType = 'sparkling white wine';
  const prompt = `A single tall ${wineType} bottle, no glass, isolated on dark slate stone surface, minimalist composition, label visible facing camera, soft warm dramatic lighting from upper-left, deep shadows, dark blurred warm-lit French restaurant interior background with amber bokeh, photorealistic, ultra-detailed, premium product photography, 1:1 ratio, ${name.replace(/\(bout\.?\)/i, '').trim()}`;
  f.imgUrl = { stringValue: pollinationsUrl(prompt) };
  imgFixed++;
});

console.log(`\n=== Total : +${added} ajouts | ~${fixed} prix | 🍾 ${imgFixed} photos vin bouteille ===`);

if (DRY) { console.log('[DRY-RUN] pas de write Firestore.'); process.exit(0); }

// PATCH Firestore
const updateMask = '?updateMask.fieldPaths=products';
const r3 = await fetch(`${BASE}/config/menu${updateMask}`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { products: doc.fields.products } })
});
if (!r3.ok) { console.error('PATCH fail:', await r3.text()); process.exit(2); }
console.log('✓ Menu Firestore mis à jour.');
