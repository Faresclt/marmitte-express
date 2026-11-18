// Contrôle LECTURE SEULE de la prod : pages publiques chargées sans erreur JS.
// NE JAMAIS y ajouter la caisse (elle importerait et « recevrait » les vraies
// commandes en attente) ni aucune action d'envoi.
// Usage : node tests/prod-readonly-smoke.mjs
import { chromium } from '@playwright/test';

const BASE = 'https://faresclt.github.io/marmitte-express/';
const PAGES = ['index.html', 'client.html?table=1', 'ticket.html?id=ABCDEFGHJK'];
const IGNORE = [/Failed to load resource/i, /net::ERR_/i, /favicon/i, /permission/i, /\[SW\]/];

const browser = await chromium.launch();
let bad = 0;
for (const p of PAGES) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text()); });
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => ({ title: document.title, cards: document.querySelectorAll('.mcard, .menu-card, .prod-card, [data-pid]').length, text: document.body.innerText.slice(0, 80).replace(/\s+/g, ' ') }));
  console.log(errs.length ? '✖' : '✔', p, JSON.stringify(info), errs.slice(0, 3));
  if (errs.length) bad++;
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
