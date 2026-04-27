// Migration multi-tenant via REST API + firebase CLI OAuth token.
// Pas besoin de gcloud ADC, utilise les tokens stockés par firebase login.
//
// Usage : node functions/migrate-multitenant.mjs [--dry-run]
// Idempotent : skip docs déjà présents.

import fs from 'fs';
import path from 'path';
import os from 'os';

const PROJECT = 'la-marmitte-express';
const SLUG = 'marmitte-express';
const COLLECTIONS = ['config', 'tables', 'orders', 'payments'];
const DRY_RUN = process.argv.includes('--dry-run');

// ── Charge tokens firebase CLI ──
const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const refreshToken = cfg.tokens?.refresh_token;
if (!refreshToken) { console.error('Pas de refresh_token. Run firebase login.'); process.exit(2); }

// ── Refresh access token ──
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'; // public CLIENT_SECRET firebase CLI

async function refreshAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!r.ok) throw new Error('OAuth refresh fail: ' + await r.text());
  const j = await r.json();
  return j.access_token;
}

let TOKEN = null;
async function authHeader() { if (!TOKEN) TOKEN = await refreshAccessToken(); return { Authorization: 'Bearer ' + TOKEN }; }

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

async function listCollection(name) {
  const headers = await authHeader();
  const docs = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${name}?pageSize=300${pageToken ? '&pageToken=' + pageToken : ''}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`List ${name} fail: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (j.documents) docs.push(...j.documents);
    pageToken = j.nextPageToken;
  } while (pageToken);
  return docs;
}

async function getDoc(p) {
  const headers = await authHeader();
  const r = await fetch(`${FIRESTORE_BASE}/${p}`, { headers });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Get ${p}: ${r.status}`);
  return await r.json();
}

async function setDoc(p, fields) {
  const headers = { ...(await authHeader()), 'Content-Type': 'application/json' };
  const r = await fetch(`${FIRESTORE_BASE}/${p}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields })
  });
  if (!r.ok) throw new Error(`Set ${p}: ${r.status} ${await r.text()}`);
  return await r.json();
}

function nowTimestamp() { return { timestampValue: new Date().toISOString() }; }

async function migrateCollection(name) {
  const docs = await listCollection(name);
  let copied = 0, skipped = 0, errors = 0;
  console.log(`\n--- ${name}/ : ${docs.length} docs source ---`);
  for (const d of docs) {
    const id = d.name.split('/').pop();
    const destPath = `restaurants/${SLUG}/${name}/${id}`;
    try {
      const existing = await getDoc(destPath);
      if (existing) { skipped++; continue; }
      if (DRY_RUN) { console.log(`  [DRY] ${name}/${id}`); copied++; continue; }
      const fields = { ...(d.fields || {}), _migrated_at: nowTimestamp(), _migrated_from: { stringValue: name } };
      await setDoc(destPath, fields);
      copied++;
    } catch (e) {
      errors++;
      console.error(`  ERR ${id}: ${e.message}`);
    }
  }
  console.log(`  → ${copied} copies, ${skipped} skip, ${errors} errs`);
  return { copied, skipped, errors };
}

async function seedRestoMeta() {
  const p = `restaurants/${SLUG}/meta/info`;
  const exist = await getDoc(p);
  if (exist) { console.log(`✓ meta/info présent`); return; }
  if (DRY_RUN) { console.log(`[DRY] would create meta/info`); return; }
  await setDoc(p, {
    name: { stringValue: 'La Marmitte Express' },
    slug: { stringValue: SLUG },
    plan: { stringValue: 'free' },
    createdAt: nowTimestamp(),
    ownerUid: { nullValue: null }
  });
  console.log(`✓ meta/info créé`);
}

async function main() {
  console.log(`=== Migration ${PROJECT}: root → restaurants/${SLUG}/ ${DRY_RUN ? '[DRY]' : ''} ===`);
  const t0 = Date.now();
  await seedRestoMeta();
  let totals = { copied: 0, skipped: 0, errors: 0 };
  for (const name of COLLECTIONS) {
    const r = await migrateCollection(name);
    totals.copied += r.copied; totals.skipped += r.skipped; totals.errors += r.errors;
  }
  const dur = Math.round((Date.now() - t0) / 1000);
  if (!DRY_RUN) {
    await setDoc(`restaurants/${SLUG}/meta/migration`, {
      completedAt: nowTimestamp(),
      durationSec: { integerValue: dur },
      runner: { stringValue: 'cli-rest-api' },
      copied: { integerValue: totals.copied },
      skipped: { integerValue: totals.skipped },
      errors: { integerValue: totals.errors }
    });
  }
  console.log(`\n=== ${dur}s : ${totals.copied} copiés, ${totals.skipped} skip, ${totals.errors} errs ===`);
  process.exit(totals.errors > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(2); });
