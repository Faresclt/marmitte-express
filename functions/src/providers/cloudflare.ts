/**
 * Provider Cloudflare Workers AI — modèle par défaut Flux.1 schnell.
 * Free tier : ~10 000 neurons/jour, partagé compte Cloudflare.
 *
 * Doc : https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 */
import type { ProviderResult } from './types.js';

const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export type CloudflareConfig = {
  accountId: string;
  apiToken: string;
};

/**
 * Génère une image via Cloudflare Workers AI.
 * Retourne le binaire PNG/JPEG renvoyé par l'API.
 */
export async function generateWithCloudflare(
  prompt: string,
  config: CloudflareConfig
): Promise<ProviderResult> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${CF_MODEL}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      // Flux schnell : 4 steps suffit, qualité élevée.
      num_steps: 4,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Cloudflare ${res.status}: ${body.slice(0, 200)}`);
    // Marquer 5xx pour le router (fallback)
    (err as Error & { is5xx?: boolean }).is5xx = res.status >= 500;
    throw err;
  }

  // CF retourne soit du JSON `{result: {image: base64}}`, soit du binaire selon le modèle.
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json()) as { result?: { image?: string } };
    const b64 = json.result?.image;
    if (!b64) throw new Error('Cloudflare: réponse JSON sans image base64');
    return {
      buffer: Buffer.from(b64, 'base64'),
      mime: 'image/png',
      provider: 'cloudflare',
    };
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    buffer,
    mime: contentType || 'image/png',
    provider: 'cloudflare',
  };
}
