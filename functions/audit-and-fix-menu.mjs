// Audit menu Firestore vs PDF : add manquants, fix prix, reset photos vin bouteille.
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

const PRICE_FIXES = { p94: 6, p93: 7, p69: 4, p68: 7.5, p85: 8, p88: 8, p91: 8, p83: 8, p84: 8, p87: 6 };
let priceFixed = 0;
products.forEach(p => {
  const f = p.mapValue.fields;
  const id = f.id?.stringValue;
  if (PRICE_FIXES[id] !== undefined) {
    const oldP = f.price?.doubleValue || f.price?.integerValue;
    if (oldP !== PRICE_FIXES[id]) {
      f.price = { doubleValue: PRICE_FIXES[id] };
      console.log(`  prix ${id}: ${oldP}€ -> ${PRICE_FIXES[id]}€`);
      priceFixed++;
    }
  }
});

let imgReset = 0;
products.forEach(p => {
  const f = p.mapValue.fields;
  const name = f.name?.stringValue || '';
  const cat = f.cat?.stringValue;
  if (cat === 'alcools' && /\(bout\.?\)|bouteille/i.test(name) && f.imgUrl?.stringValue) {
    delete f.imgUrl;
    imgReset++;
  }
});

const existingIds = new Set(products.map(p => p.mapValue.fields.id?.stringValue));
const MISSING = [
  { id: 'p110', cat: 'plats', name: "Bavette à l'échalotte", price: 15,
    description: "Bavette de bœuf charolaise grillée, échalotes confites au vin rouge.",
    garniture: "Au choix : pommes de terre sautées, salade, pâtes ou frites maison",
    hasGarniture: true },
  { id: 'p111', cat: 'desserts', name: "Salade de Fruits Frais", price: 8,
    description: "Salade de fruits frais de saison, légèrement sucrée.",
    vegetarian: true, vegan: true, glutenFree: true },
  { id: 'p112', cat: 'desserts', name: "Blanc Manger Coco", price: 7,
    description: "Blanc manger à la noix de coco, coulis de fruits rouges. Texture onctueuse.",
    allergens: ['Lait'], vegetarian: true, glutenFree: true },
  { id: 'p113', cat: 'alcools', name: "La Piscine de Rosé", price: 5,
    description: "Vin rosé servi sur glaçons dans grand verre. Rafraîchissant.",
    alcohol: true, allergens: ['Sulfites'] },
  { id: 'p114', cat: 'alcools', name: "Jet 31", price: 6,
    description: "Liqueur Jet 31, version blanche du Jet 27, anis et menthe.",
    alcohol: true },
  { id: 'p115', cat: 'alcools', name: "Rouge 25cl (pression)", price: 5,
    description: "Bière rouge à la pression, 25cl.", alcohol: true, allergens: ['Gluten'] }
];

let added = 0;
MISSING.forEach(item => {
  if (existingIds.has(item.id)) return;
  const tva = ['plats','salades','entrees','desserts','softs'].includes(item.cat) ? 10 : 20;
  const fields = {
    id: { stringValue: item.id },
    name: { stringValue: item.name },
    cat: { stringValue: item.cat },
    price: { doubleValue: item.price },
    tva: { doubleValue: tva }
  };
  if (item.description) fields.description = { stringValue: item.description };
  if (item.garniture) fields.garniture = { stringValue: item.garniture };
  if (item.allergens) fields.allergens = { arrayValue: { values: item.allergens.map(a => ({ stringValue: a })) } };
  if (item.vegetarian) fields.vegetarian = { booleanValue: true };
  if (item.vegan) fields.vegan = { booleanValue: true };
  if (item.glutenFree) fields.glutenFree = { booleanValue: true };
  if (item.alcohol) fields.alcohol = { booleanValue: true };
  if (item.hasGarniture) fields.hasGarniture = { booleanValue: true };
  products.push({ mapValue: { fields } });
  console.log(`  + ${item.id} ${item.name} ${item.price}€`);
  added++;
});

console.log(`\n${priceFixed} prix fix, ${imgReset} images vin bouteille reset, ${added} produits ajoutés.`);

if (DRY) { console.log('[DRY] pas de write.'); process.exit(0); }

const r3 = await fetch(`${BASE}/config/menu?updateMask.fieldPaths=products`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { products: doc.fields.products } })
});
if (!r3.ok) { console.error('PATCH fail:', await r3.text()); process.exit(2); }
console.log('✓ Menu Firestore mis à jour.');
