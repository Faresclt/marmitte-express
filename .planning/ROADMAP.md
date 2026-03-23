# Roadmap: La Marmite Express v1.0

**Created:** 2026-03-24
**Milestone:** v1.0 — Multi-Restaurant SaaS MVP

## Phases

### Phase 1: Design System & Redesign UI
- [ ] Complete

**Goal:** Créer un design system cohérent et redesigner toutes les pages (serveur, client, cuisine, caisse) avec un look premium professionnel.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06

**Success Criteria:**
- Design system documenté avec variables CSS partagées
- Page serveur redesignée avec nouveau design
- Page client redesignée (menu appétissant, panier fluide)
- Page cuisine optimisée pour écran distant
- Caisse mise à jour avec composants cohérents
- Animations et micro-interactions sur toutes les pages

---

### Phase 2: Stabilité & Robustesse
- [ ] Complete

**Goal:** Corriger les bugs récurrents, fiabiliser la synchronisation localStorage/Firestore, et ajouter une gestion d'erreurs propre.

**Requirements:** STAB-01, STAB-02, STAB-03, STAB-04

**Success Criteria:**
- Sync bidirectionnelle localStorage ↔ Firestore sans perte
- Retry automatique sur erreurs réseau avec feedback UI
- Migration de données testée et documentée
- Pas de régression sur commandes et paiements
- Gestion gracieuse de la déconnexion Firebase

---

### Phase 3: Architecture Multi-Restaurant
- [ ] Complete

**Goal:** Transformer l'app single-tenant en multi-tenant : chaque restaurant a son propre espace isolé dans Firestore avec des URLs uniques.

**Requirements:** MULTI-01, MULTI-02, MULTI-03, MULTI-04, MULTI-05

**Success Criteria:**
- Structure Firestore `restaurants/{slug}/...` fonctionnelle
- Toutes les pages lisent/écrivent dans le bon namespace
- URLs format `?resto=slug` ou path-based routing
- Isolation totale des données entre restaurants
- Firebase rules mises à jour pour l'isolation
- Migration des données existantes vers le nouveau schéma

---

### Phase 4: Personnalisation par Restaurant
- [ ] Complete

**Goal:** Permettre à chaque restaurant de personnaliser son apparence (couleurs, logo, thème) avec propagation sur toutes les pages.

**Requirements:** PERSO-01, PERSO-02, PERSO-03, PERSO-04

**Success Criteria:**
- Interface de personnalisation dans la caisse (couleur accent, logo, nom)
- Le branding se propage automatiquement sur serveur, client, cuisine
- Option thème clair/sombre fonctionnelle
- Les changements sont persistés dans Firestore par resto
- Preview en temps réel des changements de branding

---

### Phase 5: Onboarding & Inscription
- [ ] Complete

**Goal:** Créer un flux d'inscription pour les nouveaux restaurants avec assistant de configuration et menu de démo.

**Requirements:** ONB-01, ONB-02, ONB-03, ONB-04

**Success Criteria:**
- Page d'inscription avec création de compte (email/password Firebase Auth)
- Assistant pas-à-pas : nom du resto → logo → couleurs → menu démo
- Menu de démo pré-rempli (catégories + produits exemple)
- Plan de salle par défaut avec 8 tables
- Le resto est fonctionnel immédiatement après l'onboarding
- Temps total inscription → opérationnel < 10 minutes

---

## Summary

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 1 | Design System & Redesign UI | UX-01..06 | Not Started |
| 2 | Stabilité & Robustesse | STAB-01..04 | Not Started |
| 3 | Architecture Multi-Restaurant | MULTI-01..05 | Not Started |
| 4 | Personnalisation par Restaurant | PERSO-01..04 | Not Started |
| 5 | Onboarding & Inscription | ONB-01..04 | Not Started |

**Total:** 5 phases, 23 requirements

---
*Roadmap created: 2026-03-24*
