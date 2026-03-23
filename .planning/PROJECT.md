# La Marmite Express

## What This Is

Système de caisse (POS) et commande en ligne pour restaurants, construit en HTML/JS vanilla avec Firebase comme backend temps réel. L'app couvre le cycle complet : prise de commande (serveur + client QR code), affichage cuisine temps réel, encaissement avec calcul TVA, plan de salle interactif, et génération d'images IA pour le menu. L'objectif est d'en faire un produit SaaS vendable à d'autres restaurants.

## Core Value

Un restaurant doit pouvoir s'inscrire et être opérationnel en quelques minutes avec un système de caisse complet, moderne et fiable — sans aucune installation technique.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ POS complet avec encaissement, TVA, historique — v1.0
- ✓ Plan de salle interactif avec drag-and-drop — v1.0
- ✓ Commande serveur avec cuisson/garnitures — v1.0
- ✓ Commande client via QR code — v1.0
- ✓ Écran cuisine temps réel avec notifications sonores — v1.0
- ✓ Génération QR codes automatique — v1.0
- ✓ Génération d'images IA (Gemini) avec 4 styles — v1.0
- ✓ PWA avec support offline — v1.0
- ✓ Sécurité XSS, CSP, PIN lockout — v1.0

### Active

<!-- Current scope. Building toward these. -->

- [ ] Multi-restaurant : chaque resto a son propre espace isolé
- [ ] Onboarding autonome : un resto peut s'inscrire et configurer sans aide
- [ ] Redesign pro de toutes les pages (serveur, client, cuisine, caisse)
- [ ] Stabilité : correction des bugs récurrents (sync, données perdues)
- [ ] Dashboard stats basique (CA quotidien, produits populaires)
- [ ] Personnalisation par resto (couleurs, logo, branding)

### Out of Scope

- Paiement en ligne (Stripe/PayPal) — complexité réglementaire, v2+
- Application mobile native — PWA suffit pour v1
- Gestion des stocks avancée — v2
- Système de réservation — v2
- Chat/messaging entre staff — v2

## Context

- **Stack** : HTML/JS/CSS vanilla, Firebase 10.12 (Firestore + Storage), no build step
- **Architecture** : Chaque page est un fichier HTML autonome (~4000 lignes pour la caisse)
- **Données** : localStorage + Firestore sync, DATA_VERSION 10 (10 migrations)
- **Design** : Dark theme, Bebas Neue + DM Sans, glassmorphism, CSS variables
- **Hosting** : GitHub Pages (statique), Firebase pour le backend
- **Problèmes connus** : Design incohérent entre pages, bugs de sync localStorage/Firebase, pas de multi-tenant

## Constraints

- **Tech stack** : Rester en vanilla JS/HTML — pas de framework (simplicité, pas de build step)
- **Backend** : Firebase uniquement — pas de serveur custom
- **Budget** : Firebase free tier (Spark plan) doit suffire pour le MVP
- **Multi-tenant** : Un seul projet Firebase avec isolation par collections (path-based)
- **Hosting** : Rester sur GitHub Pages ou équivalent gratuit

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vanilla JS, pas de framework | Simplicité, pas de build step, tout inline | ✓ Good |
| Firebase comme seul backend | Temps réel natif, pas de serveur à gérer | ✓ Good |
| Multi-tenant sur un seul Firebase | Scalable, un seul projet à maintenir | — Pending |
| Dark theme par défaut | Look premium, différenciant | ✓ Good |
| Images IA via Gemini | Gratuit (500/jour), qualité suffisante | ✓ Good |

---
*Last updated: 2026-03-24 after GSD initialization*
