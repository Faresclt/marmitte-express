import type { ProviderId } from '../types.js';

/** Résultat brut d'un provider IA — image binaire + métadonnées. */
export type ProviderResult = {
  buffer: Buffer;
  mime: string;
  provider: ProviderId;
};
