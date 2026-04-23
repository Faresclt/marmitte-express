# Phase 4 : Personnalisation + Refonte images IA — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning (après Phase 3)
**Execution order:** 3e
**Scope:** ÉLARGI (12 requirements au lieu de 4 originaux)

<domain>
## Phase Boundary

2 chantiers combinés :
1. **Personnalisation resto** : tout l'habillage configurable par un resto acheteur (branding, typo, photos, infos, menu layout, caisse i18n)
2. **Refonte génération images IA** : sortir de `setup-images.html` actuel (hardcodé, clé Gemini client, localStorage base64) pour une architecture SaaS (Cloud Function proxy, Firebase Storage, catalogue dynamique)

## Hors scope

- Wizard d'onboarding (phase 5)
- Design system final (phase 1)
- Features IA avancées : hybrid upload+IA, éditeur crop, versioning, régénération en masse (v2)

</domain>

<decisions>
## Implementation Decisions

### Provider IA par défaut : Cloudflare Workers AI

- Vérifié 2026-04-21 : 10 000 neurons/jour gratuit toujours actif
- Modèle : `@cf/black-forest-labs/flux-1-schnell` (qualité Midjourney)
- Fallback : `@cf/bytedance/stable-diffusion-xl-lightning` si Flux down
- Fallback 2 : Pollinations.ai (URL GET, sans clé)

### Architecture proxy

```
Resto UI → Cloud Function Firebase `generateImage`
            ↓
         Provider router (selon plan + quota resto)
            ↓
         Cloudflare Workers AI (défaut) / fal.ai (premium)
            ↓
         Upload Firebase Storage + resize 3 tailles (Cloud Function `resizeImage` trigger onFinalize)
            ↓
         Retour URL signée au client
```

### Storage 3 tailles

- `restaurants/{slug}/images/{productId}/{version}/` contient :
  - `original.webp` (1600px max)
  - `large.webp` (1200px) + `large.jpg` (fallback)
  - `medium.webp` (600px) + `medium.jpg`
  - `thumb.webp` (200px) + `thumb.jpg`
  - `blurhash.txt` (20 chars pour LQIP)
- Génération via Cloud Function `resizeImage` avec `sharp` (trigger onFinalize Storage)

### Firestore schema personnalisation

```
restaurants/{slug}/branding/
  identity     { name, slug, tagline, description, cuisine }
  colors       { accent, accent2, mode }
  typography   { fontId, titleFamily, bodyFamily }
  photos       [ { url, alt, position } ]
  imageStyle   { styleId, customPrompt }
restaurants/{slug}/contact/
  address, phone, email, website, hours, closedDays
restaurants/{slug}/social/
  instagram, facebook, tiktok, snapchat, x
restaurants/{slug}/ui/
  menuLayout, menuDensity, priceDisplay, badges, sortMode
restaurants/{slug}/operations/
  taxRates, currency, dateFormat, language, tipPresets
```

### 8 combos typographie curated

1. Bebas Neue + DM Sans (brasserie moderne)
2. Playfair Display + Lato (classique élégant)
3. Oswald + Open Sans (sport / street food)
4. Montserrat + Inter (minimaliste tech)
5. Pacifico + Nunito (café / salon de thé)
6. Cormorant Garamond + Source Sans Pro (haut de gamme)
7. Abril Fatface + Karla (magazine)
8. Anton + Roboto (bold / impact)

### Claude's Discretion

- Structure exacte de la Cloud Function (Node.js 20 runtime)
- Format des URLs signées (TTL, encoding)
- Détails UX du picker couleur + preview iframe

</decisions>

<code_context>
## Prérequis Phases 2 et 3

- `firebase-sync.js` avec `getCurrentResto()` → pour scoper les configs
- Firebase Auth + rules strictes → pour protéger `branding/` (écriture admin only)
- Firestore multi-tenant → `restaurants/{slug}/` existe

## Refactor setup-images.html

Le fichier actuel devient obsolète. Remplacé par :
- `personnalisation.html` : UI principale de configuration resto
- Section "Images" dans `personnalisation.html` avec liste auto des produits sans image
- Cloud Function `generateImage` côté backend

</code_context>
