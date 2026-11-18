/**
 * Cloudflare Worker — envoi du ticket de caisse par email (Brevo) — La Marmite Express
 *
 * ─── Contrat v2 (2026-11-18) ────────────────────────────────────────────
 *   POST  Content-Type: application/json   body = { "ticketId": "...", "to": "client@exemple.fr" }
 *   Rien d'autre n'est accepté : le sujet, le contenu et l'expéditeur ne
 *   viennent PLUS du navigateur (avant : relais ouvert, n'importe qui pouvait
 *   envoyer n'importe quel mail au nom du resto).
 *
 *   Le worker :
 *     1. relit le ticket en lecture publique REST Firestore
 *        tickets/{ticketId} (règle : get public, list interdit) ;
 *     2. refuse s'il est absent ou créé il y a plus de 48 h ;
 *     3. limite à 3 envois par ticket (KV « RATE » si lié, sinon cache CF) ;
 *     4. construit sujet + HTML + texte côté serveur, tout échappé ;
 *     5. envoie via Brevo avec un expéditeur FIXE (SENDER_EMAIL / SENDER_NAME).
 *   Réponse : { ok: true } ou { ok: false, error: "message" } (+ code HTTP).
 *
 * ─── Variables (Settings → Variables and Secrets) ───────────────────────
 *   BREVO_API_KEY    (Secret) clé API Brevo « xkeysib-… »
 *   SENDER_EMAIL     expéditeur vérifié sur Brevo
 *   SENDER_NAME      nom affiché (ex. « La Marmite Express »)
 *   ALLOWED_ORIGIN   origine(s) autorisée(s), séparées par des virgules.
 *                    Défaut : https://faresclt.github.io  (plus de « * »)
 *   FIREBASE_API_KEY (optionnel) clé web publique Firebase, ajoutée à la
 *                    lecture REST si besoin.
 *   Binding KV « RATE » (optionnel, recommandé) : Settings → Bindings →
 *                    KV namespace, nom de variable RATE. Sans lui, la limite
 *                    passe par le cache Cloudflare (par datacenter, au mieux ;
 *                    l'API Cache peut être inactive sur *.workers.dev).
 *
 * ─── Redéploiement (dashboard Cloudflare, sans CLI) ─────────────────────
 *   1. dash.cloudflare.com → Workers & Pages → ouvrir le worker existant
 *      (ex. « caisse-mailer ») → « Edit code ».
 *   2. Tout sélectionner, supprimer, coller CE fichier → « Deploy ».
 *   3. Settings → Variables and Secrets : vérifier BREVO_API_KEY,
 *      SENDER_EMAIL, SENDER_NAME ; ajouter ALLOWED_ORIGIN si l'app n'est pas
 *      servie depuis https://faresclt.github.io.
 *   4. (Recommandé) Storage & Databases → KV → créer « mailer-rate », puis
 *      Settings → Bindings → KV namespace → variable RATE → ce namespace.
 *   5. L'URL du worker ne change pas : la caisse la publie dans
 *      config/menu.settings.mailWorkerUrl (lue par ticket.html).
 *   (Avec Wrangler : `wrangler deploy worker/brevo-mailer.js`.)
 */

const PROJECT_ID = 'la-marmitte-express';
const FIRESTORE_DOC_BASE =
  'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/tickets/';
const DEFAULT_ORIGIN = 'https://faresclt.github.io';
const MAX_AGE_MS = 48 * 3600 * 1000;
const MAX_SENDS_PER_TICKET = 3;
const TICKET_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export default {
  async fetch(req, env) {
    const allowed = String(env.ALLOWED_ORIGIN || DEFAULT_ORIGIN)
      .split(',').map((s) => s.trim()).filter(Boolean);
    const reqOrigin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(reqOrigin) ? reqOrigin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ ok: false, error: 'Méthode non autorisée' }, 405, cors);
    // Un navigateur envoie toujours Origin sur un POST cross-origin : refuser les autres sites.
    if (reqOrigin && !allowed.includes(reqOrigin)) {
      return json({ ok: false, error: 'Origine non autorisée' }, 403, cors);
    }
    if (!env.BREVO_API_KEY || !env.SENDER_EMAIL) {
      return json({ ok: false, error: 'Relais mail mal configuré' }, 500, cors);
    }

    let body;
    try {
      const raw = await req.text();
      if (raw.length > 2000) return json({ ok: false, error: 'Requête trop grosse' }, 413, cors);
      body = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: 'JSON invalide' }, 400, cors);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, error: 'JSON invalide' }, 400, cors);
    }
    const extra = Object.keys(body).filter((k) => k !== 'ticketId' && k !== 'to');
    if (extra.length) return json({ ok: false, error: 'Champs non acceptés : ' + extra.join(', ') }, 400, cors);

    const ticketId = String(body.ticketId || '');
    const to = String(body.to || '').trim();
    if (!TICKET_ID_RE.test(ticketId)) return json({ ok: false, error: 'ticketId invalide' }, 400, cors);
    if (to.length > 254 || !EMAIL_RE.test(to)) return json({ ok: false, error: 'Adresse email invalide' }, 400, cors);

    // 1. Lecture du ticket (REST public)
    let ticket, createTime;
    try {
      const url = FIRESTORE_DOC_BASE + encodeURIComponent(ticketId) +
        (env.FIREBASE_API_KEY ? '?key=' + encodeURIComponent(env.FIREBASE_API_KEY) : '');
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (r.status === 404) return json({ ok: false, error: 'Ticket introuvable' }, 404, cors);
      if (!r.ok) return json({ ok: false, error: 'Lecture du ticket impossible (' + r.status + ')' }, 502, cors);
      const docJson = await r.json();
      ticket = fromFields(docJson.fields || {});
      createTime = docJson.createTime;
    } catch {
      return json({ ok: false, error: 'Lecture du ticket impossible' }, 502, cors);
    }

    // 2. Fraîcheur : createTime (posé par Firestore) sinon createdAt
    const created = Date.parse(createTime || ticket.createdAt || '');
    if (!Number.isFinite(created) || Date.now() - created > MAX_AGE_MS) {
      return json({ ok: false, error: 'Ticket expiré (plus de 48 h)' }, 410, cors);
    }

    // 3. Anti-abus : au plus N envois par ticket
    if (!(await takeSendSlot(env, ticketId))) {
      return json({ ok: false, error: 'Trop d\'envois pour ce ticket' }, 429, cors);
    }

    // 4. Contenu construit côté serveur
    const content = buildEmail(ticket);

    // 5. Envoi Brevo, expéditeur fixe
    const payload = {
      sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'Restaurant' },
      to: [{ email: to }],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    };
    let brevoRes;
    try {
      brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return json({ ok: false, error: 'Service mail injoignable' }, 502, cors);
    }
    if (!brevoRes.ok) {
      // Détail Brevo gardé dans les logs du worker, pas renvoyé au navigateur
      console.log('brevo error', brevoRes.status, (await brevoRes.text()).slice(0, 500));
      return json({ ok: false, error: 'Envoi refusé par le service mail (' + brevoRes.status + ')' }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

// ── Limite d'envois ────────────────────────────────────────────────────
async function takeSendSlot(env, ticketId) {
  const key = 'sends:' + ticketId;
  const ttl = 3 * 24 * 3600;
  if (env.RATE && typeof env.RATE.get === 'function') {
    const n = parseInt((await env.RATE.get(key)) || '0', 10) || 0;
    if (n >= MAX_SENDS_PER_TICKET) return false;
    await env.RATE.put(key, String(n + 1), { expirationTtl: ttl });
    return true;
  }
  try {
    const cache = caches.default;
    const cacheKey = new Request('https://mailer-rate.internal/' + encodeURIComponent(key));
    const hit = await cache.match(cacheKey);
    const n = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (n >= MAX_SENDS_PER_TICKET) return false;
    await cache.put(cacheKey, new Response(String(n + 1), { headers: { 'Cache-Control': 'max-age=' + ttl } }));
  } catch {
    /* cache indisponible : la limite d'âge (48 h) reste la seule barrière */
  }
  return true;
}

// ── Format REST Firestore typé → objet JS ──────────────────────────────
function fromFields(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) out[k] = fromValue(fields[k]);
  return out;
}
function fromValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue; // ISO 8601
  if ('mapValue' in v) return fromFields((v.mapValue && v.mapValue.fields) || {});
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fromValue);
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  return null;
}

// ── Construction du mail (même mise en page que la caisse) ─────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const num = (v) => Number(v) || 0;
const eur = (v) => num(v).toFixed(2) + '€';
const oneLine = (s, n) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').slice(0, n);
const httpsUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
const hexColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c || '').trim()) ? String(c).trim() : '#f5a623');

function buildEmail(t) {
  const resto = t.resto || {};
  const restoName = oneLine(resto.name || 'Restaurant', 80);
  const items = Array.isArray(t.items) ? t.items.slice(0, 200) : [];
  const tvaRates = t.tvaRates && typeof t.tvaRates === 'object' ? t.tvaRates : {};
  const reviews = t.reviews || {};
  const lg = t.legal || {};
  const tableName = t.tableNum ? 'Table ' + oneLine(t.tableNum, 20) : 'Vente directe';
  const payLabel = t.payType === 'cb' ? 'Carte bancaire' : t.payType === 'cash' ? 'Espèces' : 'Offert';
  const date = oneLine(t.date, 20), time = oneLine(t.time, 10), number = oneLine(t.number, 30);
  const rates = Object.keys(tvaRates).sort((a, b) => parseFloat(a) - parseFloat(b));
  const google = httpsUrl(reviews.google), trip = httpsUrl(reviews.tripadvisor);

  // Texte brut
  let text = restoName + '\n';
  if (number) text += 'Ticket N° ' + number + '\n';
  text += date + ' à ' + time + '\n' + tableName + ' — ' + payLabel + '\n\n';
  items.forEach((i) => {
    const opts = [i.cuisson, i.garniture].filter(Boolean).map((x) => oneLine(x, 60)).join(', ');
    text += num(i.qty) + 'x ' + oneLine(i.name, 120) + (opts ? ' (' + opts + ')' : '') + ' — ' + eur(num(i.qty) * num(i.price)) + '\n';
  });
  if (rates.length) {
    text += '\n— TVA —\n';
    rates.forEach((r) => { text += 'HT ' + oneLine(r, 8) + '% : ' + eur((tvaRates[r] || {}).ht) + '  |  TVA : ' + eur((tvaRates[r] || {}).tva) + '\n'; });
    text += '\nTotal HT  : ' + eur(t.totalHT) + '\nTotal TVA : ' + eur(t.totalTVA) + '\n';
  }
  text += 'TOTAL TTC : ' + eur(t.total) + '\n\nMerci de votre visite !';
  if (google) text += '\n\nLaissez-nous un avis Google : ' + google;
  if (trip) text += '\nTripAdvisor : ' + trip;
  const legal = [lg.raison, lg.adresse, lg.siret && 'SIRET : ' + lg.siret, lg.tvaIntra && 'N° TVA : ' + lg.tvaIntra, lg.ape && 'APE : ' + lg.ape]
    .filter(Boolean).map((x) => oneLine(x, 200));
  if (legal.length) text += '\n\n— Mentions légales —\n' + legal.join('\n');

  // HTML (toutes les valeurs du ticket échappées)
  const itemRows = items.map((i) => {
    const opts = [i.cuisson, i.garniture].filter(Boolean).map((x) => oneLine(x, 60)).join(', ');
    return '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">' + num(i.qty) + 'x ' + esc(oneLine(i.name, 120)) +
      (opts ? ' <span style="color:#888;font-size:11px">(' + esc(opts) + ')</span>' : '') +
      '</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">' + eur(num(i.qty) * num(i.price)) + '</td></tr>';
  }).join('');
  const tvaRows = rates.map((r) =>
    '<tr><td style="padding:3px 8px;color:#666">HT ' + esc(oneLine(r, 8)) + '%</td><td style="padding:3px 8px;text-align:right;color:#666">' + eur((tvaRates[r] || {}).ht) +
    '</td><td style="padding:3px 8px;color:#666">TVA ' + esc(oneLine(r, 8)) + '%</td><td style="padding:3px 8px;text-align:right;color:#666">' + eur((tvaRates[r] || {}).tva) + '</td></tr>'
  ).join('');
  let reviewLinks = '';
  if (google) reviewLinks += '<a href="' + esc(google) + '" style="display:inline-block;margin:4px;padding:10px 18px;background:#4285F4;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">⭐ Avis Google</a>';
  if (trip) reviewLinks += '<a href="' + esc(trip) + '" style="display:inline-block;margin:4px;padding:10px 18px;background:#00aa6c;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">🦉 TripAdvisor</a>';
  const legalHtml = legal.length
    ? '<div style="margin-top:18px;padding-top:14px;border-top:1px dashed #ccc;font-size:10px;color:#666;text-align:center;line-height:1.6">' + legal.map(esc).join('<br>') + '</div>'
    : '';

  const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">' +
    '<div style="background:' + hexColor(resto.accent) + ';padding:20px;text-align:center;border-radius:10px 10px 0 0">' +
      '<h1 style="margin:0;color:#1a1100;font-size:22px;letter-spacing:1px">' + esc(restoName) + '</h1>' +
      (number ? '<div style="font-size:12px;color:#1a1100;margin-top:4px;font-weight:600">Ticket N° ' + esc(number) + '</div>' : '') +
    '</div>' +
    '<div style="padding:20px;border:1px solid #eee;border-top:none">' +
      '<div style="color:#666;font-size:13px;margin-bottom:14px"><strong>' + esc(tableName) + '</strong> · ' + esc(date) + ' à ' + esc(time) +
        '<br>Règlement : <strong>' + esc(payLabel) + '</strong></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' + itemRows + '</table>' +
      (tvaRows ? '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px;border-top:1px dashed #ccc;padding-top:8px">' + tvaRows + '</table>' +
        '<div style="margin-top:8px;display:flex;justify-content:space-between;font-size:12px;color:#666"><span>Total HT</span><span>' + eur(t.totalHT) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;color:#666"><span>Total TVA</span><span>' + eur(t.totalTVA) + '</span></div>' : '') +
      '<div style="margin-top:8px;padding-top:8px;border-top:2px solid #1a1a1a;display:flex;justify-content:space-between;font-size:18px;font-weight:700"><span>TOTAL TTC</span><span>' + eur(t.total) + '</span></div>' +
      (reviewLinks ? '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;text-align:center"><div style="font-size:13px;color:#666;margin-bottom:10px">Vous avez aimé ? Laissez-nous un avis 💛</div>' + reviewLinks + '</div>' : '') +
      legalHtml +
    '</div>' +
    '<div style="text-align:center;font-size:11px;color:#999;margin-top:12px">Ticket envoyé automatiquement — ne pas répondre</div>' +
  '</div>';

  const subject = oneLine('Ticket N° ' + number + ' — ' + restoName + ' — ' + date, 150);
  return { subject, html, text };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
