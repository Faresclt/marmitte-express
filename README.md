# La Marmite Express

Système de caisse (POS) + commande en ligne pour restaurants. Vanilla JS + Firebase. PWA installable.

**Status** : v1.0 en production chez le restaurant des parents. Migration SaaS multi-tenant en cours (5 phases planifiées).

## Architecture

App mono-page par rôle, chaque HTML est autonome. Partage via Firestore (source de vérité) + localStorage (cache).

| Page | Rôle | Utilisateur |
|------|------|-------------|
| `index.html` | Landing + choix rôle | Arrivée |
| `serveur.html` | Prise commande + plan de salle | Serveur |
| `client.html` | Menu via QR code | Client à table |
| `cuisine.html` | Dashboard kanban temps réel + speech synthesis | Cuisine |
| `marmite-express-caisse.html` | POS encaissement + TVA + historique | Gérant |
| `qrcodes.html` | Génération planche QR codes A4 | Admin (one-shot) |
| `setup-images.html` | Upload + génération IA images menu | Admin |

## Stack

- HTML/CSS/JS vanilla (pas de framework, pas de build)
- Firebase 10.12 (Firestore + Storage + Auth à venir)
- PWA (manifest + service worker)
- Hosting : GitHub Pages (statique gratuit)
- Génération images IA : Gemini (phase 4 → Cloudflare Workers AI pour SaaS)

## Firestore - collections actuelles

```
config/{menu,branding,settings,apikeys,images_0..N}
tables/{tableId}
orders/{orderId}
payments/{paymentId}
```

Cible multi-tenant (phase 3) : `restaurants/{slug}/...`

## Planning GSD

Roadmap v1.0 dans `.planning/` :

- Phase 2 — Stabilité & Fondations (1er)
- Phase 3 — Architecture Multi-Restaurant (2e)
- Phase 4 — Personnalisation + refonte images IA (3e)
- Phase 1 — Design System & Redesign UI (4e)
- Phase 5 — Onboarding & Inscription (5e)

**Ordre non chronologique** : fondations techniques avant design. Détails dans `.planning/STATE.md` et `.planning/ROADMAP.md`.

## Développement

Pas de build step. Ouvre les HTML directement dans un navigateur ou sers le dossier avec un serveur HTTP local :

```bash
python -m http.server 8000
# puis http://localhost:8000/index.html
```

Pour le développement Firebase, `firebase emulators:start` après installation du CLI.

## Déploiement

Push sur `main` → GitHub Pages déploie automatiquement.

## Contribuer

Repo personnel. Issues/PRs non ouverts pour le moment.

## Licence

Propriétaire - tous droits réservés.
