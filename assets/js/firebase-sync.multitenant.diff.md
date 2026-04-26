# Refacto multi-tenant pour `firebase-sync.js` (Phase 3)

**À appliquer le jour de la migration (J0 - 09h)**, pas avant.

## Principe

Ajouter un système de scoping qui résout le slug du restaurant courant et préfixe toutes les références Firestore par `restaurants/{slug}/`. Backward compat avec mode legacy si pas de slug en URL.

## Diff proposé

```diff
@@ exports avec scoping resto @@

+// Détection du slug resto depuis l'URL ou localStorage
+function detectRestoSlug() {
+  // 1. Query string ?resto=slug
+  const params = new URLSearchParams(location.search);
+  const fromUrl = params.get('resto');
+  if (fromUrl) {
+    localStorage.setItem('marmitte_resto_slug', fromUrl);
+    return fromUrl;
+  }
+  // 2. Cache localStorage (survit entre pages)
+  const cached = localStorage.getItem('marmitte_resto_slug');
+  if (cached) return cached;
+  // 3. Mode legacy (collections root) — null pendant transition
+  return null;
+}
+
+export const RESTO_SLUG = detectRestoSlug();
+const NS = RESTO_SLUG ? `restaurants/${RESTO_SLUG}` : null;
+
+/**
+ * Retourne une référence collection scopée par resto.
+ * - Si RESTO_SLUG défini : retourne restaurants/{slug}/{name}
+ * - Sinon : retourne {name} (mode legacy)
+ */
 export function col(name) {
-  return collection(db, name);
+  return NS ? collection(db, NS, name) : collection(db, name);
 }

 export function docRef(collectionName, id) {
-  return doc(db, collectionName, id);
+  return NS
+    ? doc(db, ...NS.split('/'), collectionName, id)
+    : doc(db, collectionName, id);
 }

+/**
+ * Helper compat pour les anciens appels qui font directement:
+ *   doc(db, 'orders', id)   →   docRef('orders', id)
+ * Pendant la transition, redirige vers le bon namespace.
+ */
+export function getCurrentNamespace() {
+  return NS;
+}
```

## Patterns à mettre à jour dans le code applicatif

### Avant (legacy)

```js
import { db, doc, collection, onSnapshot } from './assets/js/firebase-sync.js';

onSnapshot(doc(db, 'config', 'menu'), snap => { ... });
const ordersRef = collection(db, 'orders');
```

### Après (multi-tenant)

```js
import { db, docRef, col, onSnapshot } from './assets/js/firebase-sync.js';

onSnapshot(docRef('config', 'menu'), snap => { ... });
const ordersRef = col('orders');
```

**Stratégie** : faire un sed/replace global après la migration.

## Fichiers à modifier (estimation)

| Fichier | `doc(db, ...)` à changer | `collection(db, ...)` à changer |
|---------|--------------------------|--------------------------------|
| `client.html` | ~3 | ~1 |
| `serveur.html` | ~5 | ~2 |
| `cuisine.html` | ~2 | ~3 |
| `qrcodes.html` | ~1 | 0 |
| `setup-images.html` | ~2 | 0 |
| `marmite-express-caisse.html` | ~15 | ~6 |

Total : ~30 sites de code à updater. Faire un commit séparé après la migration.

## Tests post-refacto

- Sans `?resto=` dans l'URL → doit charger depuis collections root (legacy)
- Avec `?resto=marmitte-express` → doit charger depuis `restaurants/marmitte-express/`
- localStorage `marmitte_resto_slug` cache → 2e visite sans `?resto=` doit utiliser le cache
- Switch entre les deux modes ne doit pas mélanger les données

## Rollback

Le diff est purement additif côté `firebase-sync.js`. Pour rollback, deux options :
1. Revert le commit qui change `col()` et `docRef()`
2. OU forcer mode legacy en effaçant `localStorage.marmitte_resto_slug` + redirect URL sans `?resto=`

## Voir aussi

- `firestore.rules.v3` (rules qui valident le scoping côté serveur)
- `migrate-to-multitenant.html` (script migration des données)
- `docs/MIGRATION-MULTITENANT-PLAN.md` (plan cutover complet)
