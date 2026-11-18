// Vérifie la syntaxe des <script> inline de chaque page HTML (node --check).
// Usage : node tests/check-inline-scripts.mjs [fichiers.html...]
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : ['marmite-express-caisse.html', 'cuisine.html', 'serveur.html', 'client.html', 'ticket.html', 'index.html', 'qrcodes.html', 'setup-images.html'];
const dir = mkdtempSync(join(tmpdir(), 'inline-js-'));
let fail = 0;
for (const f of files) {
  let html;
  try { html = readFileSync(new URL(f, root), 'utf8'); } catch { continue; }
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs)) continue;
    if (/type=["']?(application\/ld\+json|text\/template)/i.test(attrs)) continue;
    const isModule = /type=["']?module/i.test(attrs);
    const p = join(dir, `${f.replace(/\W/g, '_')}_${i++}.${isModule ? 'mjs' : 'js'}`);
    // Les chaînes '<\/script>' restent valides en JS
    writeFileSync(p, m[2]);
    try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
    catch (e) { fail++; console.log(`✖ ${f} script #${i - 1} (${isModule ? 'module' : 'classic'})\n${String(e.stderr).split('\n').slice(0, 6).join('\n')}`); }
  }
  console.log(`✔ ${f} : ${i} script(s) inline analysé(s)`);
}
process.exit(fail ? 1 : 0);
