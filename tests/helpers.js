// Helpers partagés — collecte d'erreurs console avec filtrage des bruits tiers.

/** Patterns d'erreurs ignorées (réseau tiers, transitoires Firebase, favicons…). */
const IGNORED_PATTERNS = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /favicon/i,
  /404/,
  /firebaseinstallations/i,
  /installations\/.*requests are blocked/i,
  /WebChannelConnection.*transport errored/i,
  /Cross-Origin-Opener-Policy/i,
  /third-party cookie/i,
  /Tracking Prevention/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /googleapis\.com.*40[34]/i,
  /service.?worker/i,
];

/**
 * Attache un collecteur d'erreurs console graves sur la page.
 * @param {import('@playwright/test').Page} page
 * @returns {string[]} tableau muté au fil de l'eau
 */
export function collectConsoleErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_PATTERNS.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return errors;
}

/**
 * Vérifie l'absence de scroll horizontal (tolérance 5px).
 * @param {import('@playwright/test').Page} page
 */
export async function getHorizontalOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    innerWidth: window.innerWidth,
  }));
}
