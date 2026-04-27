// Seed description/garniture/allergens/tags depuis le PDF menu pour les plats/salades/entrees/desserts.
// Idempotent : merge sur products[] sans toucher aux champs existants (name, price, etc.)
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

// Fetch current menu
const r2 = await fetch(`${BASE}/config/menu`, { headers: { Authorization: 'Bearer ' + TOKEN } });
const doc = await r2.json();
const products = doc.fields.products.arrayValue.values;

// Map id → enrichments (depuis PDF menu Côte de Boeuf)
const ENRICH = {
  // ENTRÉES
  p37: { description: 'Salade fraîche, tomates, pommes de terre sautées et gésiers de canard confits.', allergens: ['Œuf'] },
  p38: { description: 'Sélection de charcuteries fines selon arrivages : jambon sec, saucisson, rillettes, pâté.', allergens: ['Sulfites'] },
  p39: { description: 'Calamars, acras de morue, beignets à la morue. Spécialité créole revisitée maison.', allergens: ['Gluten', 'Poisson', 'Mollusques', 'Œuf'] },
  p40: { description: 'Burrata 120g et son pesto maison à la pistache, sur lit de tomates colorées.', allergens: ['Lait', 'Fruits à coque (pistache)'], vegetarian: true },
  p41: { description: 'Os à moëlle rôti au four (20 min de cuisson). Servi avec fleur de sel et toasts.', allergens: ['Gluten'] },
  p42: { description: 'Tomates, poivrons, piments, oignons grillés, thon, olives et œuf dur. Salade tunisienne traditionnelle.', allergens: ['Poisson', 'Œuf'] },
  // PLATS
  p43: { description: 'Plat du jour selon inspiration du chef. Demandez à votre serveur la composition du jour.' },
  p44: { description: 'Pavé de saumon frais cuit à la perfection. Garniture au choix.', garniture: 'Au choix : pommes de terre sautées, salade, pâtes ou frites maison', allergens: ['Poisson'] },
  p45: { description: 'Poisson du jour selon arrivage marché. Demandez à votre serveur.', allergens: ['Poisson'] },
  p46: { description: 'Poisson du jour selon arrivage, calamars, crevettes accompagné de sa sauce pesto maison à la pistache.', sauces: 'Sauce pesto maison à la pistache', allergens: ['Poisson', 'Crustacés', 'Mollusques', 'Fruits à coque (pistache)'] },
  p47: { description: 'Steak charolais haché maison ou steak végétarien, avocat, cheddar, oignons, salade. Pain artisanal.', garniture: 'Frites maison', allergens: ['Gluten', 'Lait', 'Œuf', 'Sésame'] },
  p48: { description: 'Double steak charolais haché maison, double cheddar, avocat, oignons, salade. Pour les grandes faims.', garniture: 'Frites maison', allergens: ['Gluten', 'Lait', 'Œuf', 'Sésame'] },
  p49: { description: 'Côtes d\'agneau grillées, herbes de Provence.', garniture: 'Au choix : pommes de terre sautées, salade, pâtes ou frites maison' },
  p50: { description: 'Entrecôte de bœuf charolais 300g, cuisson au choix. Viande française d\'origine certifiée.', garniture: 'Au choix : pommes de terre sautées, salade, pâtes ou frites maison' },
  p51: { description: 'La fameuse côte de bœuf 1kg à partager (idéal pour 2 personnes). Viande charolaise française maturée.', garniture: 'Pommes de terre sautées, salade, pâtes, frites maison ET légumes grillés de saison' },
  p52: { description: 'Portion supplémentaire de garniture (frites, salade, pâtes ou pommes de terre sautées).' },
  // SALADES
  p53: { description: 'Salade, tomates, pommes de terre sautées, lardons, toast de chèvre chaud. Version vegan : sans lardon, avec avocat.', allergens: ['Lait', 'Gluten'], vegetarian: true },
  p54: { description: 'Salade, tomates, pommes de terre sautées, gésiers de canard confits.' },
  p55: { description: 'Salade, tomates, pommes de terre sautées, poulet au curry maison.', allergens: ['Lait'] },
  p56: { description: 'Salade, tomates, pommes de terre sautées, lardons, toast de chèvre chaud, gésiers. Pour les gourmets.', allergens: ['Lait', 'Gluten'] },
  // DESSERTS
  p57: { description: 'Tarte du jour selon les fruits de saison. Pâte sablée maison.', allergens: ['Gluten', 'Lait', 'Œuf'], vegetarian: true },
  p58: { description: 'Crumble banane, Nutella, flambé au rhum à votre table. Servi tiède.', allergens: ['Gluten', 'Lait', 'Œuf', 'Fruits à coque (noisettes)'], vegetarian: true, alcohol: true },
  p59: { description: 'Crème brûlée maison, vanille bourbon, caramélisée minute au chalumeau.', allergens: ['Lait', 'Œuf'], vegetarian: true, glutenFree: true },
  p60: { description: 'Mousse au chocolat noir intense, recette maison.', allergens: ['Lait', 'Œuf'], vegetarian: true, glutenFree: true },
  p61: { description: 'Tiramisu maison au mascarpone et café, biscuits cuiller imbibés.', allergens: ['Gluten', 'Lait', 'Œuf'], vegetarian: true, alcohol: true },
  p62: { description: 'Café Gourmand : café accompagné de mini-desserts (crème brûlée, mousse au chocolat, tiramisu...).', allergens: ['Gluten', 'Lait', 'Œuf'], vegetarian: true }
};

let updated = 0;
products.forEach(p => {
  const fp = p.mapValue.fields;
  const id = fp.id?.stringValue;
  const enr = ENRICH[id];
  if (!enr) return;
  if (enr.description) fp.description = { stringValue: enr.description };
  if (enr.garniture) fp.garniture = { stringValue: enr.garniture };
  if (enr.sauces) fp.sauces = { stringValue: enr.sauces };
  if (enr.allergens) fp.allergens = { arrayValue: { values: enr.allergens.map(a => ({ stringValue: a })) } };
  if (enr.vegetarian) fp.vegetarian = { booleanValue: true };
  if (enr.vegan) fp.vegan = { booleanValue: true };
  if (enr.glutenFree) fp.glutenFree = { booleanValue: true };
  if (enr.spicy) fp.spicy = { booleanValue: true };
  if (enr.alcohol) fp.alcohol = { booleanValue: true };
  updated++;
});

console.log(`${updated} produits enrichis (sur ${Object.keys(ENRICH).length} mappings).`);

if (DRY) { console.log('[DRY-RUN] pas de write.'); process.exit(0); }

// Patch entire menu doc
const updateMask = '?updateMask.fieldPaths=products';
const r3 = await fetch(`${BASE}/config/menu${updateMask}`, {
  method: 'PATCH',
  headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { products: doc.fields.products } })
});
if (!r3.ok) { console.error('PATCH fail:', await r3.text()); process.exit(2); }
console.log('✓ Menu Firestore mis à jour avec descriptions + allergènes + tags.');
