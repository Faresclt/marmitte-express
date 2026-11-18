/**
 * Cloud Functions IA — entrée HTTPS `generateImage` (v2).
 *
 * Flow :
 *  1. Vérif Firebase Auth (Bearer ID token dans Authorization header)
 *  2. Validation body { prompt, style, productId }
 *  3. Routing provider (cloudflare > pollinations > falai fallback)
 *  4. Upload Storage `products/{productId}.jpg`
 *  5. Réponse { url, provider, durationMs }
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

import { buildPrompt } from './prompts.js';
import { routeGenerate, type RouterConfig } from './providers/router.js';
import type { StyleId, ProviderId, RestoPlan } from './types.js';

if (getApps().length === 0) {
  initializeApp();
}

// Secrets v2 (firebase functions:secrets:set ...)
const CF_ACCOUNT_ID = defineSecret('CF_ACCOUNT_ID');
const CF_API_TOKEN = defineSecret('CF_API_TOKEN');
const FALAI_API_KEY = defineSecret('FALAI_API_KEY');

const VALID_STYLES: ReadonlyArray<StyleId> = [
  'brasserie',
  'minimal',
  'rustique',
  'streetfood',
  'asiatique',
  'italien',
  'mediterraneen',
  'fastfood',
];

type GenerateBody = {
  prompt?: string;
  style?: string;
  productId?: string;
  productName?: string;
  isCold?: boolean;
  isDrink?: boolean;
  plan?: RestoPlan;
  forceProvider?: ProviderId;
};

type GenerateResponse = {
  url: string;
  provider: ProviderId;
  durationMs: number;
};

type ErrorResponse = {
  error: string;
  code: string;
};

function isStyleId(v: unknown): v is StyleId {
  return typeof v === 'string' && (VALID_STYLES as ReadonlyArray<string>).includes(v);
}

function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown>
): void {
  const payload = { event, ...data };
  if (level === 'error') logger.error(payload);
  else if (level === 'warn') logger.warn(payload);
  else logger.info(payload);
}

export const generateImage = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    timeoutSeconds: 120,
    memory: '512MiB',
    secrets: [CF_ACCOUNT_ID, CF_API_TOKEN, FALAI_API_KEY],
  },
  async (req, res) => {
    const startedAt = Date.now();

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' } satisfies ErrorResponse);
      return;
    }

    // 1. Auth check
    const authHeader = req.headers.authorization ?? '';
    const match = /^Bearer (.+)$/.exec(authHeader);
    if (!match) {
      res.status(401).json({ error: 'Missing Bearer token', code: 'unauthenticated' } satisfies ErrorResponse);
      return;
    }
    const idToken = match[1];

    let uid: string;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch (err) {
      logEvent('warn', 'auth_failed', { err: err instanceof Error ? err.message : String(err) });
      res.status(401).json({ error: 'Invalid token', code: 'unauthenticated' } satisfies ErrorResponse);
      return;
    }

    // 1b. Appareil du resto uniquement : l'auth anonyme est ouverte à tous,
    // seul un appareil enregistré (doc staff/{uid}, créé avec le code
    // d'enregistrement) peut consommer la génération d'images.
    try {
      const staffSnap = await getFirestore().collection('staff').doc(uid).get();
      if (!staffSnap.exists) {
        logEvent('warn', 'not_staff', { uid });
        res.status(403).json({ error: 'Device not enrolled', code: 'permission_denied' } satisfies ErrorResponse);
        return;
      }
    } catch (err) {
      logEvent('error', 'staff_check_failed', { uid, err: err instanceof Error ? err.message : String(err) });
      res.status(503).json({ error: 'Staff check unavailable', code: 'unavailable' } satisfies ErrorResponse);
      return;
    }

    // 2. Validation body
    const body = (req.body ?? {}) as GenerateBody;
    // `plan` venant du client est IGNORÉ (toujours 'free') : le palier payant
    // ne doit pas être choisi par l'appelant. Idem forceProvider 'falai' (payant).
    const { productId, style, prompt: customPrompt, productName, isCold, isDrink, forceProvider: rawForce } = body;
    const plan: RestoPlan = 'free';
    const forceProvider: ProviderId | undefined =
      rawForce === 'cloudflare' || rawForce === 'pollinations' ? rawForce : undefined;

    // productId sert de nom d'objet Storage (products/{productId}.jpg) : format strict.
    if (!productId || typeof productId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(productId)) {
      res.status(400).json({ error: 'productId required', code: 'invalid_argument' } satisfies ErrorResponse);
      return;
    }
    if (!isStyleId(style)) {
      res.status(400).json({ error: 'style invalid', code: 'invalid_argument' } satisfies ErrorResponse);
      return;
    }

    const finalPrompt = buildPrompt(style, {
      productName: productName ?? productId,
      isCold: Boolean(isCold),
      isDrink: Boolean(isDrink),
      customExtras: typeof customPrompt === 'string' ? customPrompt : undefined,
    });

    // 3. Routing provider
    const cfAccountId = CF_ACCOUNT_ID.value();
    const cfApiToken = CF_API_TOKEN.value();
    const falApiKey = FALAI_API_KEY.value();

    const routerCfg: RouterConfig = {
      cloudflare: cfAccountId && cfApiToken ? { accountId: cfAccountId, apiToken: cfApiToken } : undefined,
      falai: falApiKey ? { apiKey: falApiKey } : undefined,
    };

    logEvent('info', 'generate_start', { uid, productId, style, plan, forceProvider });

    let providerResult;
    try {
      providerResult = await routeGenerate(finalPrompt, routerCfg, {
        plan,
        forceProvider,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent('error', 'generate_failed', { uid, productId, msg });
      res.status(502).json({ error: msg, code: 'provider_failed' } satisfies ErrorResponse);
      return;
    }

    // 4. Upload Storage
    const objectPath = `products/${productId}.jpg`;
    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(objectPath);
      await file.save(providerResult.buffer, {
        contentType: providerResult.mime || 'image/jpeg',
        resumable: false,
        metadata: {
          metadata: {
            generatedBy: providerResult.provider,
            generatedFor: uid,
            style,
          },
        },
      });
      await file.makePublic();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logEvent('error', 'storage_upload_failed', { uid, productId, msg });
      res.status(500).json({ error: msg, code: 'storage_failed' } satisfies ErrorResponse);
      return;
    }

    const bucketName = getStorage().bucket().name;
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
    const durationMs = Date.now() - startedAt;

    logEvent('info', 'generate_done', {
      uid,
      productId,
      provider: providerResult.provider,
      durationMs,
      bytes: providerResult.buffer.length,
    });

    const out: GenerateResponse = {
      url: publicUrl,
      provider: providerResult.provider,
      durationMs,
    };
    res.status(200).json(out);
  }
);
