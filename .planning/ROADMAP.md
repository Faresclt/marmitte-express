# Roadmap: La Marmite Express v1.0

**Created:** 2026-03-24
**Reordered:** 2026-04-21 (après audit code Fares)
**Milestone:** v1.0 — Multi-Restaurant SaaS MVP

## Ordre d'exécution validé

Différent de l'ordre de numérotation GSD. Numérotation conservée pour traçabilité des requirements.

| Exec | Phase | Requirements |
|------|-------|--------------|
| 1er | **Phase 2** — Stabilité & Fondations | STAB-01 à STAB-04 (+ refactor architecture) |
| 2e | **Phase 3** — Architecture Multi-Restaurant | MULTI-01 à MULTI-05 |
| 3e | **Phase 4** — Personnalisation (scope élargi) | PERSO-01 à PERSO-12 |
| 4e | **Phase 1** — Design System & Redesign UI | UX-01 à UX-06 |
| 5e | **Phase 5** — Onboarding & Inscription | ONB-01 à ONB-04 |

**Pourquoi cet ordre :** détails dans `.planning/STATE.md` et dans le hub Obsidian `knowledge-base/projects/marmitte-express/roadmap-v1.md`. Résumé : fondations techniques avant design, refonte images IA en phase 4 car dépend de multi-tenant (phase 3), design system appliqué en dernier sur code modulaire + personnalisable (évite de redesigner 2 fois).

---

## Phase 2 (1er) : Stabilité & Fondations
- [ ] Complete

**Goal:** Refactor du monolithe 4000 lignes, sync localStorage/Firestore fiable, Firebase Auth + Firestore rules strictes, offline réel pour le POS.

**Requirements:** STAB-01, STAB-02, STAB-03, STAB-04

**Scope élargi 2026-04-21 après audit :**
- 2.A Refactor architecture : découper `marmite-express-caisse.html` en `pos.js`, `admin.js`, `firebase-sync.js`, `index.css`
- 2.B Gestion état : Firestore = Single Source of Truth, localStorage = cache offline
- 2.C Sécurité : Firebase Auth (anonyme minimum) + rules strictes
- 2.D Offline réel : `enableIndexedDbPersistence`, POS encaisse sans internet

**Success Criteria:**
- Caisse découpée en modules JS/CSS séparés, import partagé sur toutes les pages
- Sync bidirectionnelle localStorage ↔ Firestore sans perte + retry avec backoff
- Firebase Auth en place, `firestore.rules` exige `request.auth != null`
- POS fonctionne offline (encaisse, sync au retour)
- Toast/banner UI pour état déconnecté
- Tests manuels de régression sur commandes + paiements

---

## Phase 3 (2e) : Architecture Multi-Restaurant
- [ ] Complete

**Goal:** Transformer l'app single-tenant en multi-tenant : chaque restaurant a son propre espace isolé dans Firestore avec des URLs uniques.

**Requirements:** MULTI-01, MULTI-02, MULTI-03, MULTI-04, MULTI-05

**Success Criteria:**
- Structure Firestore `restaurants/{slug}/...` fonctionnelle
- Toutes les pages lisent/écrivent dans le bon namespace
- URLs format `?resto=slug` (décision : query string, pas de config GitHub Pages nécessaire)
- Isolation totale des données entre restaurants
- Firebase rules mises à jour pour l'isolation par resto
- Migration des données parents vers `restaurants/marmitte-express/...`

---

## Phase 4 (3e) : Personnalisation par Restaurant (scope élargi)
- [ ] Complete

**Goal:** Tout l'habillage configurable par resto : branding, typo, photos, infos, menu layout, caisse i18n + refonte complète de la génération d'images IA pour le SaaS.

**Requirements:** PERSO-01 à PERSO-12 (4 originaux + 8 ajoutés 2026-04-21)

**Scope MVP :**
1. Identité editable (nom, slug, tagline, description, type cuisine)
2. Couleurs (accent + mode dark/light/auto)
3. Logo upload + propagation
4. Typographie (6-8 combos curated : Bebas+DM Sans, Playfair+Lato, Oswald+Open Sans, Montserrat+Inter, Pacifico+Nunito, Cormorant+Source Sans Pro, Abril Fatface+Karla, Anton+Roboto)
5. Infos pratiques (adresse + Maps embed, téléphone, horaires)
6. Menu layout client (grille/liste, densité, badges, tri)
7. **Refonte génération images IA** :
   - Cloud Function Firebase proxy (1 clé API côté serveur, pas côté resto)
   - Provider par défaut : **Cloudflare Workers AI** (Flux, 10k/jour gratuit)
   - Fallback : Pollinations.ai
   - Premium : fal.ai Flux.1 schnell (~0.03$/image)
   - Firebase Storage 3 tailles auto (thumb/medium/large WebP + JPEG fallback + blurhash LQIP)
   - Catalogue dynamique depuis `restaurants/{slug}/produits/` (suppression 62 produits hardcodés)
   - 4 variants à chaque génération, sélection user
   - Style ID global pour cohérence visuelle du menu

**Scope v2 (hors MVP) :** photos ambiance + IA, embed Instagram, SEO avancé (OG + Schema.org), caisse i18n, éditeur légal, hybrid upload+IA, éditeur crop/filter, versioning, régénération en masse

---

## Phase 1 (4e) : Design System & Redesign UI
- [ ] Complete

**Goal:** Design system cohérent appliqué sur code modulaire + multi-tenant + personnalisable. Une seule refonte, pas deux.

**Requirements:** UX-01, UX-02, UX-03, UX-04, UX-05, UX-06

**Context gathered:** `.planning/phases/01-design-system-redesign-ui/01-CONTEXT.md` (2026-03-24)

**Success Criteria:**
- `design-system.css` centralisé avec CSS variables importées depuis `branding/` par resto
- Classes utilitaires : `.btn`, `.card`, `.badge`, `.input`
- Breakpoints mobile-first : 480px / 768px / 1024px
- Les 4 pages redesignées (serveur, client, cuisine, caisse)
- Animations 200-300ms cubic-bezier(.4,0,.2,1), cohérentes partout

---

## Phase 5 (5e) : Onboarding & Inscription
- [ ] Complete

**Goal:** Créer un flux d'inscription SaaS. Utilise toutes les phases précédentes (auth, multi-tenant, perso, design).

**Requirements:** ONB-01, ONB-02, ONB-03, ONB-04

**Success Criteria:**
- Page d'inscription avec Firebase Auth (email/password, Google optionnel)
- Wizard pas-à-pas : type cuisine → nom resto → logo → couleurs → photos → menu démo → horaires
- Menu démo pré-rempli par IA depuis le type de cuisine (brasserie/pizzeria/tapas/etc.)
- Plan de salle par défaut avec 8 tables
- Temps total inscription → opérationnel < 10 minutes
- Redirect direct vers la caisse avec URL `?resto=slug`

---

## Summary

| Exec | Phase | Name | Requirements | Status |
|------|-------|------|--------------|--------|
| 1er | 2 | Stabilité & Fondations | STAB-01..04 (+ refactor) | Not Started |
| 2e | 3 | Architecture Multi-Restaurant | MULTI-01..05 | Not Started |
| 3e | 4 | Personnalisation + images IA | PERSO-01..12 | Not Started |
| 4e | 1 | Design System & Redesign UI | UX-01..06 | Context discussed |
| 5e | 5 | Onboarding & Inscription | ONB-01..04 | Not Started |

**Total:** 5 phases, **31 requirements**

---
*Roadmap created: 2026-03-24*
*Reordered and scope expanded: 2026-04-21 after code audit*
