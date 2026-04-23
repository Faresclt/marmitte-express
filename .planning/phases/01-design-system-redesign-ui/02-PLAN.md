# Phase 1 : Design System & Redesign UI — Plan détaillé

**Created:** 2026-04-21
**Phase:** 1 (4e dans l'ordre d'exécution, après 2-3-4)
**Effort estimé:** 3-4 jours
**Context source:** `01-CONTEXT.md` (2026-03-24)

## Pourquoi en 4e (pas en 1er comme le numéro le suggère)

Le design system appliqué en dernier = **un seul refactor design** (pas deux). Les CSS variables dépendent du branding par resto (phase 4), donc appliquer le design avant = risque de tout refaire quand la perso arrive.

## Découpage en 3 blocs + 11 tâches

### Bloc 1.A — Design system CSS centralisé (4 tâches)

#### 1.A.1 Compléter `design-system.css`
- Partant du fichier créé en phase 2.A.4 (qui contenait juste les `:root` vars)
- Ajouter les classes utilitaires : `.btn`, `.btn-accent`, `.btn-outline`, `.card`, `.badge`, `.input`, `.select`, `.modal`, `.toast`
- Breakpoints mobile-first : 480px / 768px / 1024px
- Les CSS variables sont overridées par `loadBranding()` (phase 4.D.1)
- **Deliverable** : commit "feat(01A): design-system.css avec classes utilitaires"

#### 1.A.2 Tokens typographiques
- Variables pour tailles : `--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-lg`, `--fs-xl`, `--fs-2xl`, `--fs-3xl`
- Variables pour weights : `--fw-regular`, `--fw-medium`, `--fw-bold`, `--fw-black`
- Variables pour line-heights : `--lh-tight`, `--lh-normal`, `--lh-relaxed`
- **Deliverable** : commit "feat(01A): tokens typo"

#### 1.A.3 Animations et transitions standardisées
- Variables : `--ease-standard: cubic-bezier(.4,0,.2,1)`, `--dur-fast: 150ms`, `--dur-normal: 250ms`, `--dur-slow: 400ms`
- Keyframes réutilisables : `@keyframes fadeIn`, `slideUp`, `pulse`, `lateFlash` (déjà existant)
- **Deliverable** : commit "feat(01A): animations standardisées"

#### 1.A.4 Utilitaires responsive
- Classes `.hidden-mobile`, `.only-mobile`, `.grid-2`, `.grid-3`, `.grid-auto`
- Gap spacing : `--gap-xs` (4), `-sm` (8), `-md` (16), `-lg` (24), `-xl` (32)
- **Deliverable** : commit "feat(01A): utilitaires responsive + spacing"

### Bloc 1.B — Redesign des 4 pages (6 tâches)

#### 1.B.1 Page serveur
- Grille visuelle plan de salle (tables = cartes avec statut coloré)
- Modal de prise de commande : layout 2 colonnes (menu à gauche, panier à droite) sur tablette
- Boutons d'action fixés en bas (FAB pattern) sur mobile
- **Deliverable** : commit "feat(01B): redesign serveur.html"

#### 1.B.2 Page client
- Cartes produit avec grandes images (ratio 16:9 ou 4:3 selon orientation)
- Panier flottant en bas avec compteur
- Catégories en onglets horizontaux scrollables (+ sticky top)
- Placeholder blurhash pendant chargement image
- **Deliverable** : commit "feat(01B): redesign client.html"

#### 1.B.3 Page cuisine
- 3 colonnes kanban (En attente / En cours / Prêt) avec couleurs cohérentes
- Cards commandes avec timer visible (retard en rouge animé)
- Mode "focus" clic sur une commande → plein écran
- **Deliverable** : commit "feat(01B): redesign cuisine.html"

#### 1.B.4 Caisse
- Layout split : panier à gauche (sticky), clavier numérique à droite
- Boutons encaissement en couleurs distinctes (espèces / CB / chèque / ticket-resto)
- Historique en modal plein écran
- **Deliverable** : commit "feat(01B): redesign caisse"

#### 1.B.5 Landing `index.html`
- Hero avec photo d'ambiance du resto (depuis `branding/photos`)
- Tagline + nom du resto en gros
- 4 boutons gros pour choisir le rôle (Serveur / Cuisine / Caisse / Client)
- Footer avec infos resto (depuis `contact/`)
- **Deliverable** : commit "feat(01B): redesign landing"

#### 1.B.6 Cohérence cross-pages
- Audit visuel : même padding, même fontsize, même hauteur de boutons partout
- Screenshots avant/après côte à côte
- **Deliverable** : commit "polish(01B): cohérence visuelle cross-pages"

### Bloc 1.C — Micro-interactions et polish (1 tâche)

#### 1.C.1 Animations subtiles
- Hover states : scale 1.02 + shadow accent sur les cards
- Tap feedback : ripple effect sur les boutons (optionnel)
- Transitions de page : fade 200ms au changement de vue interne
- Loader unifié (skeleton screen plutôt que spinner)
- Empty states illustrés (pas juste "aucun résultat")
- **Deliverable** : commit "polish(01C): micro-interactions"

## Success criteria

- [ ] `design-system.css` centralisé, importé par toutes les pages
- [ ] Les 4 pages ont un look cohérent (même composants visuels)
- [ ] Les CSS variables répondent au branding par resto (changement en live)
- [ ] Responsive OK sur mobile 320px → desktop 1920px
- [ ] Animations fluides (60fps), durées cohérentes
- [ ] Audit visuel croisé : pas de double implémentation de composant

## Voir aussi

- Context Phase 1 : `.planning/phases/01-design-system-redesign-ui/01-CONTEXT.md`
- Hub Obsidian : `knowledge-base/projects/marmitte-express/phase-01-design-system.md`
