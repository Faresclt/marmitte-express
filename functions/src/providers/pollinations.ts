/**
 * Provider Pollinations.ai — fallback gratuit sans API key.
 *
 * Doc : https://github.com/pollinations/pollinations
 * Endpoint : https://image.pollinations.ai/prompt/{encodedPrompt}?width=&height=&model=&seed=
 */
import type { ProviderResult } from './types.js';

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

export type PollinationsOptions = {
  width?: number;
  height?: number;
  model?: 'flux' | 'turbo' | 'sdxl';
  seed?: number;
};

export async function generateWithPollinations(
  prompt: string,
  opts: PollinationsOptions = {}
): Promise<ProviderResult> {
  const params = new URLSearchParams();
  params.set('width', String(opts.width ?? 1024));
  params.set('height', String(opts.height ?? 1024));
  params.set('model', opts.model ?? 'flux');
  params.set('nologo', 'true');
  if (opts.seed !== undefined) params.set('seed', String(opts.seed));

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Pollinations ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    buffer,
    mime: res.headers.get('content-type') || 'image/jpeg',
    provider: 'pollinations',
  };
}
