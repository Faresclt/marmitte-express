// Publie le plan de salle réel (scripts/plan-salle-2026.json, relevé sur
// « Plan de salle.pdf ») dans config/menu.salleLayout. La caisse et les
// téléphones serveuses le reprennent tout seuls (le cloud est maître du plan).
//
//   node scripts/apply-plan-salle.mjs          → simulation (aucune écriture)
//   node scripts/apply-plan-salle.mjs --write  → écrit salleLayout (et lui seul)
//
// Sauvegarde de l'ancien plan écrite à côté avant toute écriture.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const WRITE = process.argv.includes('--write');
const plan = JSON.parse(readFileSync(join(here, 'plan-salle-2026.json'), 'utf8'));

const cfg = JSON.parse(readFileSync(join(homedir(), '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
const tokRes = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token',
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi' }) });
const { access_token } = await tokRes.json();
const H = { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' };
const URL_MENU = 'https://firestore.googleapis.com/v1/projects/la-marmitte-express/databases/(default)/documents/config/menu';

const enc = (x) => {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === 'boolean') return { booleanValue: x };
  if (typeof x === 'number') return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (typeof x === 'string') return { stringValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x).map(([k, v]) => [k, enc(v)])) } };
};

const cur = await (await fetch(URL_MENU + '?mask.fieldPaths=salleLayout', { headers: H })).json();
const before = (cur.fields && cur.fields.salleLayout) || null;
const tables = plan.filter((e) => e.type === 'table-round' || e.type === 'table-rect');
console.log(`Plan : ${plan.length} éléments, ${tables.length} tables (${tables.map((t) => t.number).join(', ')}), ${tables.reduce((s, t) => s + t.seats, 0)} couverts`);
console.log(`Plan actuel en prod : ${before ? (before.arrayValue.values || []).length + ' éléments' : 'aucun'}`);
if (!WRITE) { console.log('Simulation : rien écrit. Relancer avec --write.'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = join(here, `salle-cloud-avant-plan-2026_${stamp}.json`);
writeFileSync(backup, JSON.stringify(before, null, 1));
console.log('Sauvegarde :', backup);
const r = await fetch(URL_MENU + '?updateMask.fieldPaths=salleLayout', { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { salleLayout: enc(plan) } }) });
if (!r.ok) throw new Error('Écriture refusée : ' + r.status + ' ' + (await r.text()).slice(0, 300));
console.log('✔ config/menu.salleLayout écrit');
