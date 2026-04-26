/**
 * Routing inter-providers avec fallback automatique.
 *
 * Stratégie :
 *  - Plan free : Cloudflare → Pollinations (si 5xx Cloudflare)
 *  - Plan premium : fal.ai → Cloudflare → Pollinations
 *  - `forceProvider` : court-circuite la logique (debug/admin)
 */
import { generateWithCloudflare, type CloudflareConfig } from './cloudflare.js';
import { generateWithPollinations } from './pollinations.js';
import { generateWithFalai, type FalaiConfig } from './falai.js';
import type { ProviderResult } from './types.js';
import type { ProviderId, RestoPlan } from '../types.js';

export type RouterConfig = {
  cloudflare?: CloudflareConfig;
  falai?: FalaiConfig;
};

export type RouteOpts = {
  plan: RestoPlan;
  forceProvider?: ProviderId;
};

type Step = { id: ProviderId; run: () => Promise<ProviderResult> };

function buildChain(
  prompt: string,
  cfg: RouterConfig,
  opts: RouteOpts
): Step[] {
  const cf: Step | null = cfg.cloudflare
    ? { id: 'cloudflare', run: () => generateWithCloudflare(prompt, cfg.cloudflare!) }
    : null;
  const fal: Step | null = cfg.falai
    ? { id: 'falai', run: () => generateWithFalai(prompt, cfg.falai!) }
    : null;
  const poll: Step = { id: 'pollinations', run: () => generateWithPollinations(prompt) };

  if (opts.forceProvider) {
    const forced = [cf, fal, poll].find(s => s?.id === opts.forceProvider);
    if (forced) return [forced];
  }

  if (opts.plan === 'premium' && fal) {
    return [fal, ...(cf ? [cf] : []), poll];
  }
  return [...(cf ? [cf] : []), poll];
}

/**
 * Génère une image en suivant la chaîne de fallback.
 * Throw uniquement si TOUS les providers échouent.
 */
export async function routeGenerate(
  prompt: string,
  cfg: RouterConfig,
  opts: RouteOpts
): Promise<ProviderResult> {
  const chain = buildChain(prompt, cfg, opts);
  if (chain.length === 0) {
    throw new Error('Aucun provider configuré');
  }
  const errors: string[] = [];

  for (const step of chain) {
    try {
      return await step.run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${step.id}: ${msg}`);
      console.warn(`[router] ${step.id} failed (${msg}), trying next`);
    }
  }

  throw new Error(`Tous les providers ont échoué — ${errors.join(' | ')}`);
}
