/**
 * Provider fal.ai — Flux.1 schnell premium (~0.03 $/image).
 *
 * Doc : https://fal.ai/models/fal-ai/flux/schnell
 */
import type { ProviderResult } from './types.js';

const FALAI_URL = 'https://fal.run/fal-ai/flux/schnell';

export type FalaiConfig = {
  apiKey: string;
};

export async function generateWithFalai(
  prompt: string,
  config: FalaiConfig
): Promise<ProviderResult> {
  const res = await fetch(FALAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`fal.ai ${res.status}: ${body.slice(0, 200)}`);
    (err as Error & { is5xx?: boolean }).is5xx = res.status >= 500;
    throw err;
  }

  const json = (await res.json()) as { images?: Array<{ url: string; content_type?: string }> };
  const first = json.images?.[0];
  if (!first?.url) throw new Error('fal.ai: réponse sans URL d\'image');

  // fal.ai retourne une URL signée → on télécharge le binaire.
  const imgRes = await fetch(first.url);
  if (!imgRes.ok) throw new Error(`fal.ai download ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  return {
    buffer,
    mime: first.content_type || imgRes.headers.get('content-type') || 'image/jpeg',
    provider: 'falai',
  };
}
