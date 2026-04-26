/**
 * Templates de prompts par style visuel.
 *
 * Inspiré de `setup-images.html` (4 styles d'origine : brasserie, minimal,
 * rustique, streetfood) et étendu à 8 styles pour Phase 4.
 *
 * Chaque template prend en entrée le contexte produit et retourne un prompt
 * anglais (les modèles Flux/SDXL fonctionnent mieux en anglais).
 */
import type { StyleId } from './types.js';

export type PromptContext = {
  productName: string;
  /** True si plat froid (salade, dessert) — change l'éclairage. */
  isCold?: boolean;
  /** True si boisson (verre/canette/tasse). */
  isDrink?: boolean;
  /** Extras libres ajoutés par l'utilisateur (refinement). */
  customExtras?: string;
};

type StyleTemplate = {
  food: (ctx: PromptContext) => string;
  drink: (ctx: PromptContext) => string;
  /** Suffixe commun (ratio, qualité). */
  suffix: string;
};

const COMMON_SUFFIX = 'Photorealistic, ultra-detailed, professional food photography, 16:9 aspect ratio.';

export const STYLE_PROMPTS: Record<StyleId, StyleTemplate> = {
  brasserie: {
    food: ({ productName, isCold }) =>
      `A cinematic, high-end product photograph of "${productName}" for a French brasserie menu. ` +
      `${isCold ? 'Cool natural light, fresh appearance.' : 'Warm golden steam rising, dramatic side lighting.'} ` +
      'Dark slate plate on aged wood table, amber bokeh background, shallow depth of field. ' +
      'Color palette: deep blacks, warm ambers, rich browns. Mood: sophisticated, premium.',
    drink: ({ productName }) =>
      `A cinematic, high-end product photograph of "${productName}" drink for a French brasserie. ` +
      'Crystal glass on polished dark bar counter with subtle condensation. Warm amber backlight. ' +
      'Background: blurred dark bar interior with warm bokeh. Shallow depth of field.',
    suffix: COMMON_SUFFIX,
  },
  minimal: {
    food: ({ productName, isCold }) =>
      `A clean, minimalist photograph of "${productName}". Pure white background, ` +
      `${isCold ? 'cool natural daylight' : 'soft natural daylight'}, white marble plate. ` +
      'Lots of negative space, Nordic style, top-down or 45° angle. ' +
      'Color palette: whites, naturals. Mood: fresh, clean, pure.',
    drink: ({ productName }) =>
      `A clean, minimalist photograph of "${productName}" drink. Pure white background, ` +
      'natural soft daylight. Simple elegant glassware on white marble. Minimal garnish. ' +
      'Clean lines, generous negative space, modern Nordic bar style.',
    suffix: COMMON_SUFFIX,
  },
  rustique: {
    food: ({ productName, isCold }) =>
      `A rustic, terroir-style photograph of "${productName}". Aged wood table, fresh herbs scattered, ` +
      `linen cloth, ceramic plate. ${isCold ? 'Soft window daylight.' : 'Warm hearth lighting.'} ` +
      'French countryside aesthetic, slight imperfection feel, hand-crafted. ' +
      'Color palette: warm browns, deep greens, cream. Mood: authentic, comforting.',
    drink: ({ productName }) =>
      `A rustic photograph of "${productName}" drink. Wooden bar counter, vintage glassware, ` +
      'soft warm window light. Fresh garnish, French farmhouse atmosphere. ' +
      'Color palette: warm woods, greens, earth tones.',
    suffix: COMMON_SUFFIX,
  },
  streetfood: {
    food: ({ productName, isCold }) =>
      `A vibrant street food photograph of "${productName}". Bold colors, dramatic neon-style lighting ` +
      `(orange and teal). ${isCold ? 'Crisp, fresh look.' : 'Steam, char marks, dynamic energy.'} ` +
      'Urban setting, dark background with colorful bokeh. Top-down or 30° angle. ' +
      'Color palette: vivid neons, blacks. Mood: energetic, bold, urban nightlife.',
    drink: ({ productName }) =>
      `A vibrant street food photograph of "${productName}" drink. Bold colorful presentation, ` +
      'dramatic neon lighting (orange + blue). Urban dark background, colorful bokeh. ' +
      'Condensation catching light. Mood: energetic, bold.',
    suffix: COMMON_SUFFIX,
  },
  asiatique: {
    food: ({ productName, isCold }) =>
      `An Asian-inspired food photograph of "${productName}". Dark stone or bamboo surface, ` +
      'chopsticks, ceramic bowl, sesame and fresh herbs. ' +
      `${isCold ? 'Soft cool light.' : 'Steam rising, side spotlight.'} ` +
      'Color palette: deep blacks, jade greens, soft reds. Mood: refined, balanced, zen.',
    drink: ({ productName }) =>
      `An Asian-inspired photograph of "${productName}" drink. Tea bowl or modern Asian glassware, ` +
      'bamboo or dark stone surface, soft directional light. ' +
      'Color palette: blacks, jade, warm tones. Mood: refined, calm.',
    suffix: COMMON_SUFFIX,
  },
  italien: {
    food: ({ productName, isCold }) =>
      `An Italian trattoria photograph of "${productName}". Rustic terracotta or marble plate, ` +
      'olive oil drizzle, fresh basil, parmesan shavings. ' +
      `${isCold ? 'Mediterranean daylight.' : 'Warm amber lamp light.'} ` +
      'Color palette: reds, deep greens, golden yellows. Mood: warm, family, authentic Italian.',
    drink: ({ productName }) =>
      `An Italian trattoria photograph of "${productName}" drink. Wine glass or espresso cup, ` +
      'wooden table with checkered cloth, warm lamp light. ' +
      'Color palette: warm reds, golden yellows. Mood: convivial, traditional.',
    suffix: COMMON_SUFFIX,
  },
  mediterraneen: {
    food: ({ productName, isCold }) =>
      `A Mediterranean-style photograph of "${productName}". Sun-bleached wood table, ` +
      'olive oil, lemons, fresh herbs (oregano, thyme). Bright natural daylight, sea-blue accent. ' +
      `${isCold ? 'Crisp fresh appearance.' : 'Light steam, natural warmth.'} ` +
      'Color palette: whites, blues, olive greens, sun yellow. Mood: bright, fresh, coastal.',
    drink: ({ productName }) =>
      `A Mediterranean photograph of "${productName}" drink. White-washed table, ` +
      'fresh citrus garnish, bright natural daylight, blue accents in background. ' +
      'Mood: sunny, coastal, refreshing.',
    suffix: COMMON_SUFFIX,
  },
  fastfood: {
    food: ({ productName, isCold }) =>
      `A modern fast-food photograph of "${productName}". Clean studio lighting, ` +
      `${isCold ? 'crisp cool tones' : 'warm appealing tones'}, simple branded paper or matte plate. ` +
      'Slight motion energy, sharp focus on hero ingredient. ' +
      'Color palette: vibrant primary colors, clean whites. Mood: appetizing, modern, accessible.',
    drink: ({ productName }) =>
      `A modern fast-food photograph of "${productName}" drink. Clean studio lighting, ` +
      'simple branded cup or glass, condensation, vibrant background. ' +
      'Mood: refreshing, modern, accessible.',
    suffix: COMMON_SUFFIX,
  },
};

/**
 * Construit le prompt final pour un produit donné.
 *
 * @example
 * buildPrompt('brasserie', { productName: 'Burger Maison', isCold: false })
 */
export function buildPrompt(style: StyleId, ctx: PromptContext): string {
  const tpl = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.brasserie;
  const base = ctx.isDrink ? tpl.drink(ctx) : tpl.food(ctx);
  const extras = ctx.customExtras ? ` Additional direction: ${ctx.customExtras}.` : '';
  return `${base}${extras} ${tpl.suffix}`;
}

/** Liste des styles avec libellé FR pour l'UI. */
export const STYLE_LABELS: Record<StyleId, { label: string; emoji: string; desc: string }> = {
  brasserie: { label: 'Brasserie premium', emoji: '🍷', desc: 'Fond ardoise, vapeur dorée, bokeh ambré' },
  minimal: { label: 'Clean & Minimal', emoji: '✨', desc: 'Fond blanc pur, lumière naturelle' },
  rustique: { label: 'Rustique terroir', emoji: '🌿', desc: 'Bois ancien, herbes fraîches, campagne' },
  streetfood: { label: 'Street food', emoji: '🔥', desc: 'Néons, ambiance urbaine, dynamique' },
  asiatique: { label: 'Asiatique', emoji: '🥢', desc: 'Pierre sombre, bambou, herbes fraîches' },
  italien: { label: 'Italien', emoji: '🍝', desc: 'Terracotta, basilic, ambiance trattoria' },
  mediterraneen: { label: 'Méditerranéen', emoji: '🫒', desc: 'Bois clair, citrons, accents bleus' },
  fastfood: { label: 'Fast-food moderne', emoji: '🍔', desc: 'Studio clean, couleurs vives' },
};
