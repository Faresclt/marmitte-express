# Phase 3 : Multi-Restaurant — Plan détaillé

**Created:** 2026-04-21
**Phase:** 3 (2e dans l'ordre)
**Effort estimé:** 2-3 jours

## Découpage en 3 blocs + 10 tâches

### Bloc 3.A — Routing et identification resto (3 tâches)

#### 3.A.1 Parsing du slug
- Dans `firebase-sync.js` : `export function getCurrentResto()` qui lit `?resto=` dans l'URL
- Fallback : localStorage (pour survie entre pages)
- Si rien → redirect `landing.html` (placeholder, remplissé en phase 5)
- **Deliverable** : commit "feat(03A): parsing slug resto depuis URL"

#### 3.A.2 Helpers de collection scopés resto
- `getCollection('commandes')` → `doc(db, 'restaurants', slug, 'commandes')`
- Refactor toutes les références aux collections dans `pos.js`, `admin.js`, `serveur.html`, etc.
- **Deliverable** : commit "refactor(03A): collections scopées par resto"
- **Test** : ouvrir `?resto=marmitte-express`, vérifier que les données s'affichent

#### 3.A.3 Propagation du slug dans les liens
- Tous les `<a href="serveur.html">` deviennent `serveur.html?resto=...`
- Idem QR codes (phase QR codes doit embarquer le slug)
- **Deliverable** : commit "feat(03A): slug propagé dans tous les liens internes"

### Bloc 3.B — Migration des données (4 tâches)

#### 3.B.1 Script de migration
- `migrate-to-multitenant.html` : lit racine, copie sous `restaurants/marmitte-express/`
- Collections réelles à migrer (vérifié 2026-04-22) :
  - `config/{menu,branding,settings,apikeys,images_0..N}` → `restaurants/marmitte-express/config/*`
  - `tables/*` → `restaurants/marmitte-express/tables/*`
  - `orders/*` → `restaurants/marmitte-express/orders/*`
  - `payments/*` → `restaurants/marmitte-express/payments/*`
- Log détaillé (nombre de docs copiés par collection)
- Idempotent (peut re-tourner sans doublons)
- **Deliverable** : commit "feat(03B): script de migration one-shot"

#### 3.B.2 Exécution migration + validation
- Lancer le script en local pointant vers le Firestore prod
- Vérifier manuellement que `restaurants/marmitte-express/` contient tout
- Comparer counts : racine vs. scoped
- **Deliverable** : commit "feat(03B): migration exécutée + validée"

#### 3.B.3 Cutover
- Déployer la nouvelle version qui lit depuis `restaurants/marmitte-express/`
- Vérifier chez les parents que tout marche
- **Deliverable** : commit "feat(03B): cutover production vers multi-tenant"

#### 3.B.4 Purge des anciennes collections
- Après 1 semaine sans incident
- Script `cleanup-legacy-root.html` qui supprime les collections racine
- **Deliverable** : commit "chore(03B): purge collections legacy root"

### Bloc 3.C — Sécurité et isolation (3 tâches)

#### 3.C.1 Collection `users` par resto
- `restaurants/{slug}/users/{uid}` avec `{role: 'admin'|'serveur'|'cuisine'}`
- Pour le resto des parents : seed avec l'UID anonyme actuel + role admin
- **Deliverable** : commit "feat(03C): users par resto avec rôles"

#### 3.C.2 Firestore rules isolées
- Helper function `isResto(slug)` en haut des rules
- Chaque règle de collection : `allow read, write: if isResto(resource.id || slug)`
- Exception menu client : lecture publique de `produits/` et `categories/`
- **Deliverable** : commit "feat(03C): firestore.rules isolation multi-tenant"

#### 3.C.3 Tests d'isolation
- Créer un 2e resto fictif `resto=test-isolation` avec un UID différent
- Tenter de lire les données du resto des parents depuis le compte `test-isolation` → doit échouer
- **Deliverable** : commit "test(03C): isolation multi-tenant validée"

## Success criteria

- [ ] URL `?resto=marmitte-express` fonctionne sur toutes les pages
- [ ] Toutes les données sont sous `restaurants/marmitte-express/...`
- [ ] Les collections racine sont vides après purge
- [ ] Un UID du resto A ne peut pas accéder aux données du resto B
- [ ] Le menu client reste lisible sans auth

## Voir aussi

- Hub Obsidian : `knowledge-base/projects/marmitte-express/phase-03-multi-restaurant.md`
