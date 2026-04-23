# Phase 4 : Personnalisation + Refonte images IA — Plan détaillé

**Created:** 2026-04-21
**Phase:** 4 (3e dans l'ordre)
**Effort estimé:** 5-7 jours (plus grosse phase)

## Découpage en 5 blocs + 22 tâches

### Bloc 4.A — Backend Cloud Functions (5 tâches)

#### 4.A.1 Init Firebase Functions
- `firebase init functions` en Node.js 20
- Structure : `functions/src/index.ts` (TypeScript ok ici, même si le client reste vanilla)
- Deps : `firebase-admin`, `firebase-functions`, `sharp`, `blurhash-core`
- **Deliverable** : commit "chore(04A): init Firebase Functions Node 20"

#### 4.A.2 Cloud Function `generateImage`
- Endpoint HTTPS callable
- Input : `{ productId, style, prompt }`
- Output : `{ jobId }` (async)
- Vérifie quota resto (read `restaurants/{slug}/usage/{yyyy-mm}`)
- Route vers Cloudflare Workers AI par défaut
- **Deliverable** : commit "feat(04A): Cloud Function generateImage"

#### 4.A.3 Client Cloudflare Workers AI
- Account ID + API token en env vars (`firebase functions:config:set cloudflare.token=xxx`)
- Appel à `https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/@cf/black-forest-labs/flux-1-schnell`
- Récupère le binaire, upload vers Firebase Storage
- **Deliverable** : commit "feat(04A): integration Cloudflare Workers AI"

#### 4.A.4 Cloud Function `resizeImage` (Storage trigger)
- Trigger `onFinalize` sur `restaurants/**/images/**/original.*`
- Avec `sharp` : génère 3 tailles (thumb 200 / medium 600 / large 1200) en WebP + JPEG fallback
- Calcule le blurhash 20 chars pour LQIP
- Upload dans le même dossier
- **Deliverable** : commit "feat(04A): resize auto 3 tailles + blurhash"

#### 4.A.5 Fallback Pollinations + fal.ai
- Si Cloudflare retourne erreur 5xx : fallback sur `image.pollinations.ai`
- Si resto en plan premium : router vers `fal.ai/fl/run/fal-ai/flux/schnell`
- **Deliverable** : commit "feat(04A): fallback Pollinations + route premium fal.ai"

### Bloc 4.B — UI personnalisation (9 tâches)

#### 4.B.1 Structure `personnalisation.html`
- Page dédiée accessible depuis la caisse (admin only)
- Sections collapsibles : Identité / Couleurs / Typo / Logo / Photos / Infos / Réseaux / Menu / Caisse
- Preview iframe à droite (client.html en mode preview)
- **Deliverable** : commit "feat(04B): structure personnalisation.html"

#### 4.B.2 Section Identité
- Form : nom, slug (lecture seule), tagline, description, type cuisine (select parmi 15 types)
- Persist dans `restaurants/{slug}/branding/identity`
- **Deliverable** : commit "feat(04B): perso identité resto"

#### 4.B.3 Section Couleurs (color picker)
- Input couleur accent (HSL picker + HEX manuel)
- Input couleur accent secondaire (optionnel)
- Select mode : dark / light / auto
- Vérification contraste WCAG AA en temps réel
- **Deliverable** : commit "feat(04B): perso couleurs + contraste WCAG"

#### 4.B.4 Section Typographie (8 combos)
- Grille visuelle des 8 combos avec preview
- Au clic : charge les fonts via `<link>` dynamique + applique CSS variables
- **Deliverable** : commit "feat(04B): perso typographie 8 combos"

#### 4.B.5 Section Logo
- Upload SVG (priorité) ou PNG transparent
- Upload vers `restaurants/{slug}/assets/logo.{ext}`
- Preview sur fond clair + fond sombre
- **Deliverable** : commit "feat(04B): upload logo"

#### 4.B.6 Section Photos d'ambiance
- Upload 3-5 photos landing
- Option "Générer une photo d'ambiance" (IA, type cuisine → prompt)
- Recadrage auto 16:9
- **Deliverable** : commit "feat(04B): photos ambiance upload + IA"

#### 4.B.7 Section Infos pratiques
- Form : adresse (avec géocoding Nominatim gratuit → lat/lng), téléphone, email, site web
- Horaires : grille jours/heures (matin + soir)
- Jours de fermeture exceptionnels (calendrier)
- Maps embed iframe OpenStreetMap (gratuit, pas Google Maps)
- **Deliverable** : commit "feat(04B): infos pratiques + geocoding + Maps OSM"

#### 4.B.8 Section Réseaux + Menu layout + Caisse i18n
- Réseaux : liens Insta/Facebook/TikTok/Snapchat/X
- Menu layout : select grille/liste/carrousel + densité + affichage prix + badges
- Caisse i18n : devise, TVA rates, format date, langue
- **Deliverable** : commit "feat(04B): réseaux + menu layout + caisse i18n"

#### 4.B.9 Preview iframe temps réel
- Iframe à droite affiche `client.html?resto=...&preview=true`
- Debounce 300ms sur les changements
- Bouton "Publier" pour persister vers Firestore
- **Deliverable** : commit "feat(04B): preview iframe temps réel"

### Bloc 4.C — Refonte flow génération images (4 tâches)

#### 4.C.1 Liste auto des produits sans image
- Lire `restaurants/{slug}/produits/` → filtrer ceux sans `imageUrl`
- Afficher en grille avec bouton "Générer" par produit
- **Deliverable** : commit "feat(04C): liste auto produits sans image"

#### 4.C.2 Génération 4 variants
- Au clic "Générer" : appel Cloud Function `generateImage` 4 fois en parallèle
- Afficher les 4 variants en grille, user clique le meilleur
- Les 3 autres sont supprimés du Storage
- **Deliverable** : commit "feat(04C): génération 4 variants + sélection"

#### 4.C.3 Refinement par prompt
- Après sélection, champ "Améliorer" : "plus lumineux" / "angle différent" / custom
- Relance `generateImage` avec prompt ajusté
- **Deliverable** : commit "feat(04C): refinement par prompt"

#### 4.C.4 Suppression de `setup-images.html`
- Ancien fichier remplacé par la section Images de `personnalisation.html`
- `git rm setup-images.html`
- **Deliverable** : commit "refactor(04C): remove legacy setup-images.html"

### Bloc 4.D — Propagation branding sur toutes les pages (2 tâches)

#### 4.D.1 Loader de branding
- Dans `firebase-sync.js` : `export async function loadBranding()` qui lit `branding/` + `contact/` + `ui/` + `operations/`
- Applique via `document.documentElement.style.setProperty` (couleurs + fonts)
- Cache 1h en localStorage
- **Deliverable** : commit "feat(04D): loader branding avec cache 1h"

#### 4.D.2 Integration sur toutes les pages
- `index.html`, `serveur.html`, `client.html`, `cuisine.html`, `caisse.html` appellent `loadBranding()` au démarrage
- **Deliverable** : commit "feat(04D): branding propagé sur toutes les pages"

### Bloc 4.E — Tests + documentation (2 tâches)

#### 4.E.1 Tests de régression
- Script de test : créer un resto test, configurer tout, vérifier propagation
- **Deliverable** : commit "test(04E): scénario complet perso"

#### 4.E.2 Documentation admin
- `docs/PERSONNALISATION.md` : guide pour un resto qui veut customiser
- **Deliverable** : commit "docs(04E): guide personnalisation resto"

## Success criteria

- [ ] `personnalisation.html` accessible et fonctionnelle (toutes les sections)
- [ ] Preview iframe temps réel fonctionne
- [ ] Génération IA sans clé API resto (Cloudflare Workers AI)
- [ ] 4 variants générés en parallèle, sélection user
- [ ] Images stockées en Storage avec 3 tailles + blurhash
- [ ] Branding se propage automatiquement sur toutes les pages
- [ ] `setup-images.html` supprimé (legacy)
- [ ] Quota resto respecté (alertes si > 80%)

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Cloudflare Workers AI change son free tier | Coût non prévu | Fallback Pollinations opérationnel |
| `sharp` plantage Cloud Functions | Images pas redimensionnées | Try/catch + fallback sans resize |
| Quota Cloudflare épuisé en plein onboarding | Resto frustré | Alert à 80%, fallback Pollinations |

## Voir aussi

- Hub Obsidian : `knowledge-base/projects/marmitte-express/phase-04-personnalisation.md`
- Refonte images : `knowledge-base/projects/marmitte-express/refonte-images-ia.md`
- Stratégie IA : `knowledge-base/projects/marmitte-express/strategie-ia-provider.md`
- Personnalisation détaillée : `knowledge-base/projects/marmitte-express/personnalisation-page-resto.md`
