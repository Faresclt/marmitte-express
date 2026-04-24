# Historique des migrations DATA_VERSION

Tâche 2.B.1 du plan `.planning/phases/02-stabilite-fondations/02-PLAN.md`.

## Mécanisme actuel

Dans `marmite-express-caisse.html` (fonction `migrateProducts()` autour de la ligne 1480), `DATA_VERSION` est un compteur qui force un **reset complet du catalogue produits + catégories** à chaque bump :

```js
if (currentVer < DATA_VERSION) {
  products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
  cats = JSON.parse(JSON.stringify(DEFAULT_CATS));
  LS.set('products', products);
  LS.set('cats', cats);
  LS.set('data_version', DATA_VERSION);
}
```

**Caractéristiques importantes** :

- **Reset destructif** : les modifs produits faites par le gérant sont écrasées à chaque bump
- **Scope limité** : n'impacte QUE `products` + `cats` dans localStorage. Les commandes (`orders/`), historique (`payments/`), tables (`tables/`) et config (`config/menu`) ne sont PAS touchés
- **Cas else** : si `currentVer >= DATA_VERSION`, seuls les produits manquants du `DEFAULT_PRODUCTS` sont ajoutés (pas de reset)
- **Pas versionné granulairement** : il n'existe pas de migration `v1→v2`, `v2→v3`... juste un seed complet rejoué

## Historique des bumps (reconstitué depuis `git log`)

| Version | Commit | Date | Motif |
|---------|--------|------|-------|
| 1-8 | (commits Add files via upload multiples) | mars 2026 | Pré-GSD, bumps silencieux à chaque refresh catalogue |
| 9 | `171197a` | 2026-03-22 | Bump v9 : force full product migration + sync all fields |
| 10 | `f3fa7af` | 2026-03-22 | HOTFIX v10 : supprime un filtre produit dangereux, force reset complet |

Les versions 1→8 ne sont pas tracées individuellement dans git — elles ont été faites avant le passage en source control propre.

## Problèmes du mécanisme actuel

1. **Reset silencieux** : l'utilisateur (gérant) ne voit rien, ses modifs de catalogue disparaissent au prochain chargement. Aucun warning UI.
2. **Pas de backup avant reset** : si une modif était faite localement sans sync Firestore, elle est perdue.
3. **Pas de migration ciblée** : impossible de dire "renomme juste le produit p42" sans tout écraser.
4. **Pas de rollback** : si un bump introduit un bug, pas de moyen de revenir à la version précédente des données.

## Plan pour v11 et au-delà (phase 2.B.3 + 2.B.5)

### v11 — Migration non destructive (cible 2026-04)

- `DATA_VERSION = 11`
- **Pas de reset automatique** : respecte les modifs utilisateur
- **Sync Firestore first** : avant toute migration locale, vérifier `config/menu` Firestore = source de vérité
- **Warning UI** : si reset nécessaire, afficher modal "Vos modifs locales vont être écrasées, confirmer ?"
- **Backup auto** : copier `localStorage` entier vers `localStorage['backup_v10_YYYYMMDD']` avant d'écrire v11

### v12+ — Migrations granulaires

- Objet `MIGRATIONS` avec handler par version :
  ```js
  const MIGRATIONS = {
    11: (data) => { /* ajoute champ allergens aux produits */ return data; },
    12: (data) => { /* renomme cat entrees → starters */ return data; },
    // ...
  };
  ```
- Exécution séquentielle : `for (let v = currentVer + 1; v <= DATA_VERSION; v++) data = MIGRATIONS[v](data);`
- Chaque migration est **idempotente** (peut être rejouée sans effet de bord)

## Impact sur le resto des parents

Au 2026-04-24, leur version locale = v10 (installée lors du déploiement HOTFIX du 22 mars). Aucun bump n'a eu lieu depuis.

**Avant tout futur bump** :
1. Backup manuel du localStorage via la console DevTools chez les parents
2. Sync explicite vers Firestore (bouton "Publier la carte" dans la caisse)
3. Test du bump sur un navigateur séparé avant déploiement chez les parents

## Voir aussi

- Plan phase 2.B : `.planning/phases/02-stabilite-fondations/02-PLAN.md`
- Hub Obsidian : `knowledge-base/projects/marmitte-express/problemes-connus.md`
