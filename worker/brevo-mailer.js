/**
 * Cloudflare Worker — Brevo email proxy pour La Marmite Express
 *
 * Reçoit { to, subject, html, text } depuis la caisse, relaie vers Brevo
 * (9000 emails/mois gratuits à vie). La clé API Brevo reste côté serveur,
 * jamais exposée dans le navigateur.
 *
 * ─── Variables d'environnement à définir (Settings → Variables) ────────
 *   BREVO_API_KEY    Clé API Brevo (commence par "xkeysib-")
 *   SENDER_EMAIL     Email expéditeur (doit être vérifié sur Brevo)
 *   SENDER_NAME      Nom affiché (ex. "La Marmite Express")
 *   ALLOWED_ORIGIN   Origin autorisé (ex. "https://faresclt.github.io")
 *                    Mettre "*" pour autoriser tout (déconseillé en prod)
 *
 * ─── Déploiement ──────────────────────────────────────────────────────
 *   Option A (sans CLI) : Dashboard Cloudflare → Workers & Pages →
 *     Create Worker → coller ce fichier → Deploy → Settings → Variables
 *     → ajouter les 4 vars ci-dessus.
 *   Option B (avec Wrangler) : `wrangler deploy worker/brevo-mailer.js`
 */

export default {
  async fetch(req, env) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, cors);
    }
    if (!env.BREVO_API_KEY) {
      return json({ error: 'Server misconfigured: BREVO_API_KEY missing' }, 500, cors);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400, cors);
    }

    const { to, subject, html, text, fromName, fromEmail, replyTo } = body || {};
    if (!to || !subject || (!html && !text)) {
      return json({ error: 'Missing required fields: to, subject, html or text' }, 400, cors);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return json({ error: 'Invalid recipient email' }, 400, cors);
    }

    const sender = {
      email: fromEmail || env.SENDER_EMAIL,
      name: fromName || env.SENDER_NAME || 'Restaurant',
    };
    if (!sender.email) {
      return json({ error: 'Server misconfigured: SENDER_EMAIL missing' }, 500, cors);
    }

    const payload = {
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html || `<pre style="font-family:monospace">${escapeHtml(text)}</pre>`,
      ...(text && { textContent: text }),
      ...(replyTo && { replyTo: { email: replyTo } }),
    };

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await brevoRes.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }

    return json(
      brevoRes.ok ? { ok: true, ...parsed } : { ok: false, error: parsed },
      brevoRes.status,
      cors
    );
  },
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
