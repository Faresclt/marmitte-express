# Requirements: La Marmite Express

**Defined:** 2026-03-24
**Core Value:** Un restaurant doit pouvoir s'inscrire et être opérationnel en quelques minutes avec un système de caisse complet, moderne et fiable.

## v1 Requirements

### Design & UX

- [ ] **UX-01**: Toutes les pages partagent un design system cohérent (couleurs, typographie, composants)
- [ ] **UX-02**: La page serveur a un design premium et fluide (pas daté)
- [ ] **UX-03**: La page client (commande QR) a un design appétissant et intuitif
- [ ] **UX-04**: La page cuisine a un design optimisé pour écran distant (lisibilité)
- [ ] **UX-05**: La caisse a une UI cohérente avec le nouveau design system
- [ ] **UX-06**: Animations et transitions fluides sur toutes les interactions

### Multi-Restaurant

- [ ] **MULTI-01**: Structure Firestore multi-tenant avec isolation par restaurant
- [ ] **MULTI-02**: Chaque restaurant a son propre slug/ID unique
- [ ] **MULTI-03**: Les URLs sont préfixées par le slug du restaurant
- [ ] **MULTI-04**: Les données d'un resto ne sont jamais visibles par un autre
- [ ] **MULTI-05**: La configuration (menu, salle, branding) est isolée par resto

### Onboarding

- [ ] **ONB-01**: Page d'inscription pour créer un nouveau restaurant
- [ ] **ONB-02**: Assistant de configuration guidé (nom, logo, couleurs)
- [ ] **ONB-03**: Menu de démo pré-rempli pour tester immédiatement
- [ ] **ONB-04**: Le restaurant est fonctionnel en moins de 10 minutes après inscription

### Stabilité

- [ ] **STAB-01**: Sync localStorage ↔ Firestore fiable (pas de perte de données)
- [ ] **STAB-02**: Gestion propre des erreurs réseau (retry, feedback utilisateur)
- [ ] **STAB-03**: Migration de données robuste entre versions
- [ ] **STAB-04**: Tests de régression sur les fonctionnalités critiques (commandes, paiements)

### Personnalisation

- [ ] **PERSO-01**: Chaque resto peut changer ses couleurs (accent, background)
- [ ] **PERSO-02**: Chaque resto peut uploader son logo
- [ ] **PERSO-03**: Le branding se propage sur toutes les pages (serveur, client, cuisine)
- [ ] **PERSO-04**: Thème clair disponible en option (pas que dark)

## v2 Requirements

### Analytics

- **STATS-01**: Dashboard avec CA quotidien/hebdo/mensuel
- **STATS-02**: Produits les plus vendus (top 10)
- **STATS-03**: Heures de pointe (heatmap)
- **STATS-04**: Export des données en CSV

### Avancé

- **ADV-01**: Système de réservation de tables
- **ADV-02**: Notifications push pour les commandes
- **ADV-03**: Mode hors-ligne complet avec sync au retour
- **ADV-04**: Gestion des stocks avec alertes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Paiement en ligne (Stripe) | Complexité réglementaire PCI-DSS, v2+ |
| App mobile native | PWA suffit, évite App Store fees |
| Multi-langue | Français d'abord, i18n en v2 |
| Gestion RH / planning staff | Hors périmètre POS |
| Intégration comptable | Trop spécifique par pays/logiciel |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 1 | Pending |
| UX-02 | Phase 1 | Pending |
| UX-03 | Phase 1 | Pending |
| UX-04 | Phase 1 | Pending |
| UX-05 | Phase 1 | Pending |
| UX-06 | Phase 1 | Pending |
| STAB-01 | Phase 2 | Pending |
| STAB-02 | Phase 2 | Pending |
| STAB-03 | Phase 2 | Pending |
| STAB-04 | Phase 2 | Pending |
| MULTI-01 | Phase 3 | Pending |
| MULTI-02 | Phase 3 | Pending |
| MULTI-03 | Phase 3 | Pending |
| MULTI-04 | Phase 3 | Pending |
| MULTI-05 | Phase 3 | Pending |
| PERSO-01 | Phase 4 | Pending |
| PERSO-02 | Phase 4 | Pending |
| PERSO-03 | Phase 4 | Pending |
| PERSO-04 | Phase 4 | Pending |
| ONB-01 | Phase 5 | Pending |
| ONB-02 | Phase 5 | Pending |
| ONB-03 | Phase 5 | Pending |
| ONB-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after initial definition*
