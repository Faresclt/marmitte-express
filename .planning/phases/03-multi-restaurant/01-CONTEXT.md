# Phase 3 : Architecture Multi-Restaurant — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning (après Phase 2)
**Execution order:** 2e

<domain>
## Phase Boundary

Transformer l'app mono-resto en SaaS multi-tenant. Chaque resto = un espace isolé dans Firestore avec URL dédiée. Pas de nouvelles features métier — scope pur architecture + routing.

## Hors scope

- Personnalisation par resto (phase 4)
- Design system (phase 1)
- Onboarding (phase 5)

</domain>

<decisions>
## Implementation Decisions

### Schema Firestore cible

```
restaurants/
  {slug}/
    commandes/
    produits/
    categories/
    salle/
    historique/
    parametres/
    users/           # UIDs Firebase Auth autorisés pour ce resto
```

### Routing — Query string choisi

- **URL format : `?resto=slug`** (décision validée le 2026-04-21)
- Pourquoi : zero config GitHub Pages, simple, SEO OK
- Rejetés : path-based (`/slug/serveur.html`) = nécessite routing serveur ; subdomain = payant (DNS)

### Migration des données des parents

- Script one-shot `migrate-to-multitenant.html` qui :
  1. Lit toutes les collections à la racine
  2. Les copie sous `restaurants/marmitte-express/...`
  3. Garde les anciennes en lecture pendant 1 semaine (backup)
  4. Purge après validation

### Isolation via Firestore rules

- Chaque règle exige `request.auth.uid` soit dans `restaurants/{slug}/users/`
- Règles helper :
  ```
  function isResto(slug) {
    return request.auth != null && exists(/databases/$(database)/documents/restaurants/$(slug)/users/$(request.auth.uid));
  }
  ```
- Menu client public : `restaurants/{slug}/produits` lisibles sans auth

### Claude's Discretion

- Gestion du `slug` par défaut si pas de query string (404 vs. redirect vers landing SaaS)
- Cache localStorage du `slug` courant pour éviter re-parse de l'URL à chaque page

</decisions>

<code_context>
## Prérequis Phase 2

- `firebase-sync.js` centralisé → on ajoute `getCurrentResto()` qui retourne le slug
- Firebase Auth anonyme + règles → on les étend avec l'isolation par resto
- Queue de sync → toujours valable, juste avec un préfixe de path

</code_context>
