# Project State: La Marmite Express

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Un restaurant doit pouvoir s'inscrire et être opérationnel en quelques minutes avec un système de caisse complet, moderne et fiable.
**Current focus:** Phase 2 — Stabilité & Fondations (1er dans le nouvel ordre)

## Current Milestone

**Version:** v1.0
**Name:** Multi-Restaurant SaaS MVP
**Started:** 2026-03-24
**Reordered:** 2026-04-21 (après audit code + décision stratégique)

## Progress (nouvel ordre validé 2026-04-21)

| Exec | Phase | Name | Status |
|------|-------|------|--------|
| 1er | 2 | Stabilité & Fondations | Not Started |
| 2e | 3 | Architecture Multi-Restaurant | Not Started |
| 3e | 4 | Personnalisation + refonte images IA (scope élargi) | Not Started |
| 4e | 1 | Design System & Redesign UI | Context discussed |
| 5e | 5 | Onboarding & Inscription | Not Started |

**Completed:** 0/5 phases
**Requirements totaux:** 31 (23 originaux + 8 ajoutés en phase 4 après audit)

## Key Decisions Log

| Date | Decision | Context |
|------|----------|---------|
| 2026-03-24 | Multi-tenant sur un seul Firebase | Scalable, un seul projet |
| 2026-03-24 | Rester en vanilla JS | Pas de build step, simplicité |
| 2026-03-24 | Design-first approach | ABANDONNÉ le 2026-04-21 |
| 2026-04-21 | **Ordre des phases : 2 → 3 → 4 → 1 → 5** | Audit du code révèle dette technique critique (fichier 4000 lignes, PIN contournable, Firestore rules ouvertes, clé Gemini exposée). Fondations avant design. |
| 2026-04-21 | **Phase 4 élargie : +8 requirements** | Refonte complète génération images IA (Cloud Function proxy, Firebase Storage 3 tailles, catalogue dynamique) + personnalisation page resto (typo 8 combos, infos pratiques, menu layout, i18n caisse) |
| 2026-04-21 | **Cloudflare Workers AI comme provider IA par défaut** | 10k req/jour gratuit, Flux qualité Midjourney, pas de clé côté client. Fallback Pollinations.ai. Premium fal.ai Flux.1 schnell (0.03$/image) |
| 2026-04-21 | **Gemini OK pour le resto des parents en attendant** | Mono-resto, 500 req/jour largement suffisant. Switch Cloudflare au moment de la phase 3 multi-tenant |

## Blockers/Concerns

- **2 commits locaux non pushés** vers origin/main → à pusher avant de reprendre
- Code pas touché depuis le 2026-03-24 → vérifier que l'app prod tourne toujours chez les parents avant de refactor

## Context stratégique

- **Pas de deal/prospect imminent** (confirmé 2026-04-21) → pas de pression temps
- Parents d'abord, revente ensuite
- Budget zéro → priorité aux solutions gratuites (Cloudflare Workers AI, Pollinations)

## Références externes

Hub Obsidian complet : `../../knowledge-base/projects/marmitte-express/HOME.md`

---
*Last updated: 2026-04-21*
