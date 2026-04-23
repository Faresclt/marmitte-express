# Phase 2 : Stabilité & Fondations — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Execution order:** 1er (avant toutes les autres phases)

<domain>
## Phase Boundary

Refactor architectural du monolithe `marmite-express-caisse.html` (4000+ lignes), fiabilisation de la synchronisation localStorage/Firestore, mise en place de Firebase Auth + Firestore rules strictes, support offline réel pour le POS. Pas de nouvelles fonctionnalités visibles — focus fondations techniques invisibles pour l'utilisateur mais bloquantes pour le SaaS.

## Hors scope

- Changements de design visuel (réservé phase 1, 4ème dans l'ordre d'exécution)
- Multi-tenant / isolation par resto (phase 3)
- Personnalisation resto / refonte images IA (phase 4)
- Inscription / onboarding (phase 5)

</domain>

<decisions>
## Implementation Decisions

### 2.A — Refactor architecture

- Découper `marmite-express-caisse.html` (251 KB, 4000+ lignes) en fichiers séparés :
  - `assets/css/design-system.css` (variables CSS + classes utilitaires minimales — version 1 du design system, sera complété en phase 1)
  - `assets/css/caisse.css` (styles spécifiques POS)
  - `assets/js/firebase-sync.js` (init Firebase + wrapper collections + sync bidirectionnelle)
  - `assets/js/pos.js` (logique POS : commandes, encaissement, TVA, division de note)
  - `assets/js/admin.js` (backoffice : produits, catégories, config)
  - `marmite-express-caisse.html` devient une coquille HTML qui importe ces modules
- Appliquer `firebase-sync.js` aux 4 autres pages (`serveur`, `client`, `cuisine`, `setup-images`) pour éliminer la duplication init Firebase

### 2.B — Gestion d'état (Single Source of Truth)

- **Décision validée** : Firestore = source de vérité, localStorage = cache offline uniquement
- Pattern write-through : toute écriture passe d'abord par localStorage (optimistic UI) puis est poussée vers Firestore dans une queue
- Si Firestore échoue : la queue retry avec exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Toast/banner UI pour état déconnecté + statut de la queue (N opérations en attente)
- Documenter les 10 migrations `DATA_VERSION` dans un fichier `DATA_MIGRATIONS.md` avant d'en ajouter une 11e

### 2.C — Sécurité

- Migration de la protection PIN frontend vers **Firebase Auth anonyme** (minimum viable)
  - L'utilisateur qui ouvre la caisse reçoit un UID anonyme Firebase (sans compte explicite)
  - Le PIN reste utilisé côté UX (rapidité) mais devient lié à l'UID
- Réécriture de `firestore.rules` :
  - Toute opération exige `request.auth != null`
  - Lecture publique uniquement pour `produits/` et `categories/` (permet au menu client via QR de charger sans auth)
  - Tests des règles avec Firebase Emulator avant déploiement
- La clé API Gemini reste côté client pour cette phase (la refonte proxy est prévue en phase 4)

### 2.D — Offline réel

- Activer `enableIndexedDbPersistence(db)` sur Firestore (persistence locale)
- Le POS doit pouvoir encaisser hors-ligne :
  - Write dans IndexedDB via Firestore SDK
  - Affichage d'un indicateur "offline" dans l'UI (banner)
  - Sync automatique au retour de la connexion
- Tests manuels : couper internet pendant un service simulé, vérifier que l'encaissement marche + que les données remontent au retour

### Claude's Discretion

- Choix des breakpoints de cache (quelles collections cacher, TTL) si nécessaires
- Structure interne des modules JS (exports nommés vs. objets globaux — privilégier ES modules avec `import/export`)

</decisions>

<code_context>
## Existing Code Insights

### Ce qui existe et marche

- Firebase 10.12 déjà intégré via CDN ESM dans chaque page
- Structure des collections Firestore : `commandes/`, `produits/`, `categories/`, `salle/`, `historique/`, `parametres/`
- 10 migrations `DATA_VERSION` passées silencieusement (cf. logique `DATA_VERSION=10` dans la caisse)
- PWA fonctionnelle : `manifest.json` + `sw.js` (service worker pour cache offline statique)
- Protection XSS + CSP + input validation déjà en place

### Patterns existants

- ES modules via CDN Firebase (`import { initializeApp } from "https://...firebase-app.js"`)
- `localStorage` avec JSON stringify/parse (cf. helper `LS` dans `setup-images.html`)
- Firebase branding dynamique via `document.documentElement.style.setProperty`
- Canvas pour compression d'image côté client

### Fichiers autonomes actuels (à ne PAS casser)

- `index.html` — landing
- `serveur.html` — prise commande + plan de salle
- `client.html` — menu QR code
- `cuisine.html` — dashboard temps réel
- `marmite-express-caisse.html` — POS (fichier cible du refactor)
- `setup-images.html` — import/génération images (refonte phase 4)
- `qrcodes.html` — générateur QR par table

</code_context>

<specifics>
## Specific Constraints

- **Aucune régression fonctionnelle tolérée** : le resto des parents tourne en prod, chaque changement doit être testé avant merge
- **Pas de framework introduit** : rester en vanilla ES modules
- **Pas de bundler** : pas de Webpack/Vite/esbuild — les modules JS sont importés directement en `<script type="module">`
- **GitHub Pages compatible** : tout doit marcher sans serveur Node.js
- **Commits fréquents** : un commit par tâche atomique, message clair, permet rollback rapide

</specifics>

<deferred>
## Deferred Ideas

- Tests automatisés (unit / E2E) — reporté à v2, test manuel suffit pour cette phase
- Migration vers Firebase 11+ si breaking change — reporté à un sprint dédié
- Monitoring production (Sentry/LogRocket) — reporté à v2
- Upgrade PWA vers service worker avancé (background sync) — reporté, dépend de cette phase

</deferred>
