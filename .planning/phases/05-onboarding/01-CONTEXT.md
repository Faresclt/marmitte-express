# Phase 5 : Onboarding & Inscription — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning (après Phase 1)
**Execution order:** 5e (dernière)

<domain>
## Phase Boundary

Créer un flux d'inscription SaaS qui permet à un nouveau restaurant de passer de 0 à opérationnel en moins de 10 minutes. Utilise TOUTES les phases précédentes (Auth, multi-tenant, perso, design).

## Hors scope

- Paiement du SaaS (Stripe) : v2
- Plans tarifaires différenciés : v2 (en attendant = tout gratuit)
- Multi-utilisateurs par resto : v2 (1 admin suffit au MVP)

</domain>

<decisions>
## Implementation Decisions

### Firebase Auth : email/password uniquement au MVP

- Pas de Google/Apple/Facebook au MVP (ajout v2 si demandé)
- Email vérifié via lien Firebase Auth natif
- Password : 8 caractères min, règles de complexité Firebase par défaut

### Wizard 7 étapes (3-7 minutes)

1. **Type cuisine** (brasserie / pizzeria / tapas / asiatique / bistrot / fusion / vegan / autre) → préselectionne style images + typo + palette
2. **Compte** (email + password)
3. **Identité resto** (nom, slug auto-généré éditable, tagline, adresse)
4. **Branding** (skip possible → defaults appliqués ; sinon logo + couleur accent)
5. **Photos d'ambiance** (skip → generation IA auto avec type cuisine ; sinon upload)
6. **Menu démo** (pre-rempli 10 plats typiques du type cuisine, images IA générées en arrière-plan pendant les étapes précédentes)
7. **Plan de salle** (8 tables par défaut, grille 4x2, éditable)

### Seed menu démo par type

Par type de cuisine, 10 plats emblématiques pré-définis avec descriptions. Exemples :
- Brasserie : Entrecôte frites, Tartare de bœuf, Salade Caesar, Burger maison, Poulet rôti, Crème brûlée, Mousse au chocolat, Café gourmand, Pichet rouge, Kir royal
- Pizzeria : Margherita, Reine, 4 fromages, Chorizo, Capricciosa, Calzone, Tiramisu, Panna cotta, Chianti, San Pellegrino
- Tapas : Croquetas jamón, Patatas bravas, Gambas ajillo, Tortilla española, Pulpo gallega, Jamón Serrano, Churros chocolat, Flan, Sangria, Rioja

### Génération images menu démo

- Dès l'étape 1 (choix type cuisine), lancer en arrière-plan la génération de 10 images via Cloud Function (phase 4)
- Au moment de l'étape 6, les images sont déjà prêtes ou en cours → attente max 30s
- Si Cloudflare quota épuisé : fallback Pollinations (garantie de complétion)

### URL post-inscription

Redirect vers `caisse.html?resto=slug` avec message de bienvenue + tour guidé (overlay 1ère visite).

### Claude's Discretion

- Format exact du slug (lowercase, tirets, unicité Firestore check)
- Design du wizard (steps indicator, animations de transition entre étapes)
- Gestion des erreurs réseau pendant l'inscription (sauvegarde progressive localStorage pour reprise)

</decisions>

<code_context>
## Prérequis (phases précédentes)

- **Phase 2** : Firebase Auth + Firestore rules → Auth email/password activable dans la foulée
- **Phase 3** : multi-tenant → création d'un nouveau `restaurants/{slug}/` automatisée
- **Phase 4** : personnalisation + images IA → le wizard réutilise ces briques
- **Phase 1** : design system → le wizard a le même look que le reste du SaaS

</code_context>
