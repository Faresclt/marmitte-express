/**
 * Types partagés entre la Cloud Function et le client SDK.
 * À ré-exporter côté client pour typer les appels httpsCallable.
 */

export type StyleId =
  | 'brasserie'
  | 'minimal'
  | 'rustique'
  | 'streetfood'
  | 'asiatique'
  | 'italien'
  | 'mediterraneen'
  | 'fastfood';

export type ProviderId = 'cloudflare' | 'pollinations' | 'falai';

export type RestoPlan = 'free' | 'premium';

/** Input du callable `generateImage`. */
export type GenerateImageInput = {
  /** ID Firestore du produit (`restaurants/{slug}/produits/{productId}`). */
  productId: string;
  /** Slug du restaurant — résolu côté serveur depuis l'auth claim, mais peut être passé pour debug. */
  restoSlug: string;
  /** Style visuel à appliquer (cf. `prompts.ts`). */
  style: StyleId;
  /** Prompt additionnel (refinement, ex: "plus lumineux"). Optionnel. */
  prompt?: string;
  /** Force un provider (debug / admin). Sinon routing automatique. */
  forceProvider?: ProviderId;
};

/** Output du callable `generateImage`. */
export type GenerateImageOutput = {
  /** Job ID = chemin Storage de l'original (sert d'idempotency key). */
  jobId: string;
  /** URLs des variantes resize. Vide si resize pas encore fini → poll Firestore. */
  urls: {
    thumb?: string;
    medium?: string;
    large?: string;
  };
  /** Provider effectivement utilisé. */
  provider: ProviderId;
  /** Quota restant pour le mois. */
  quota: {
    used: number;
    limit: number;
  };
};

/** Document Firestore pour le suivi des jobs (polling côté client). */
export type ImageJobDoc = {
  jobId: string;
  productId: string;
  restoSlug: string;
  status: 'pending' | 'generating' | 'resizing' | 'done' | 'error';
  provider?: ProviderId;
  style: StyleId;
  prompt?: string;
  urls?: GenerateImageOutput['urls'];
  blurhash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

/** Document Firestore pour le compteur d'usage mensuel. */
export type UsageDoc = {
  month: string; // "2026-04"
  count: number;
  byProvider: Partial<Record<ProviderId, number>>;
  lastResetAt: number;
};

/** Limites par plan. */
export const QUOTA_LIMITS: Record<RestoPlan, number> = {
  free: 200,
  premium: 2000,
};
