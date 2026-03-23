# Phase 1: Design System & Redesign UI - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Créer un design system CSS partagé et redesigner les 4 pages principales (serveur, client, cuisine, caisse) avec un look premium cohérent. Pas de changements fonctionnels — focus uniquement sur le visuel et l'architecture CSS.

</domain>

<decisions>
## Implementation Decisions

### Architecture du Design System
- Créer un fichier `design-system.css` importé par toutes les pages HTML
- Extraire des classes CSS utilitaires réutilisables (.btn, .card, .badge, .input, etc.)
- Harmoniser les variables CSS existantes (mêmes noms partout) + ajouter les manquantes
- Breakpoints responsive mobile-first : 480px, 768px, 1024px

### Direction Visuelle
- Glassmorphism modernisé : garder blur/transparence mais plus épuré et consistant
- Palette : orange #f5a623 comme accent principal (chaleureux, identité resto)
- Typographie : Bebas Neue (titres) + DM Sans (body) — garder le combo existant
- Densité confortable avec espacement généreux — touch-friendly, pro sur tablette

### Redesign des Pages
- Page serveur : grille visuelle plan de salle (intuitif, le serveur voit la salle)
- Page client : cartes produit avec images grandes (appétissant, pousse à commander)
- Page cuisine : 3 colonnes kanban (En attente / En cours / Prêt)
- Animations subtiles et fonctionnelles (transitions 200-300ms, pas de déco inutile)

### Claude's Discretion
Aucun — toutes les décisions ont été validées par l'utilisateur.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Variables CSS `:root` déjà définies dans chaque page (à centraliser)
- Background animé avec gradients radiaux + texture SVG noise (à garder)
- Système de cards glassmorphiques avec hover effects (à standardiser)
- SVG icons inline utilisés partout (à conserver)

### Established Patterns
- Tout le CSS est inline dans des balises `<style>` par page
- Flexbox + CSS Grid pour les layouts
- Transitions avec cubic-bezier(.4,0,.2,1)
- Animations @keyframes pour indicateurs de statut
- Firebase branding dynamique via `document.documentElement.style.setProperty`

### Integration Points
- Chaque page HTML est autonome (~4000 lignes pour la caisse)
- Google Fonts importé séparément dans chaque page
- PWA avec manifest.json et service worker (sw.js)
- Firebase 10.12 chargé via CDN dans chaque page

</code_context>

<specifics>
## Specific Ideas

- Le look doit être "premium professionnel" — pas amateur
- L'accent orange #f5a623 est l'identité de la marque
- Dark theme est le défaut et la priorité
- Touch-friendly est essentiel (tablettes en restaurant)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
