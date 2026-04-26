# Plan de migration Multi-Tenant — Phase 3

**Created** : 2026-04-26
**Phase** : 3 (Architecture Multi-Restaurant)
**Prérequis** : Phase 2 complétée (Auth anonyme + rules strictes deployées)

## Objectif

Passer d'un schema mono-tenant (collections à la racine) vers multi-tenant (`restaurants/{slug}/...`) sans casser l'app prod chez les parents.

## Schéma cible

```
restaurants/{slug}/
  ├── meta              { name, plan, createdAt, ownerUid }
  ├── config/
  │   ├── menu          (lecture publique pour clients QR)
  │   ├── branding
  │   ├── settings
  │   ├── apikeys       (auth admin uniquement)
  │   └── images_0..N
  ├── tables/{tableId}
  ├── orders/{orderId}
  ├── payments/{paymentId}
  ├── users/{uid}       { role: 'admin'|'serveur'|'cuisine' }
  └── images/           (Phase 4 — Firebase Storage refs)
```

## Outils créés

- **`migrate-to-multitenant.html`** : page autonome avec UI, idempotente, dry-run support, log temps réel
- **`firestore.rules.v3`** : rules strictes multi-tenant + backward compat root (J+7)
- **`assets/js/firebase-sync.multitenant.diff.md`** : diff proposé pour scoper `col()` et `docRef()` par resto

## Cutover (J0 → J+7)

### J-1 : Backup obligatoire

```bash
# Export complet Firestore vers Cloud Storage
gcloud auth login
gcloud config set project la-marmitte-express
gcloud firestore export gs://la-marmitte-express-backups/$(date +%Y%m%d)
```

Vérifier dans Firebase Console > Firestore > Export que le backup est bien là.

### J0 - 09:00 : Deploy code multi-tenant

1. Merger la branche `feat/multi-tenant` dans `main` (à créer)
2. `git push origin main` — GitHub Pages déploie automatiquement
3. Vérifier `https://faresclt.github.io/marmitte-express/migrate-to-multitenant.html` charge

**Le code est rétrocompatible** : tant que pas de `?resto=slug` dans l'URL, les pages utilisent les collections root (legacy mode).

### J0 - 10:00 : Exécuter la migration

1. Ouvrir `https://faresclt.github.io/marmitte-express/migrate-to-multitenant.html`
2. Cliquer "🔑 Sign In" → email + password admin Firebase Auth
3. Cliquer "🔍 Dry Run" pour voir les counts (config/tables/orders/payments)
4. Si counts cohérents : cliquer "▶ Lancer la migration"
5. Le script :
   - Crée `restaurants/marmitte-express/users/{adminUid}` avec role admin
   - Copie tous les docs root → `restaurants/marmitte-express/{coll}/{id}` avec `_migrated_at` timestamp
   - Skip les docs déjà présents (idempotent)
   - Écrit un rapport dans `restaurants/marmitte-express/meta/migration`
6. Vérifier dans Firebase Console > Firestore que `restaurants/marmitte-express/` contient bien tout

### J0 - 11:00 : Deploy `firestore.rules.v3`

```bash
cd marmitte-express-fixed
cp firestore.rules firestore.rules.backup-v2-$(date +%Y%m%d)
cp firestore.rules.v3 firestore.rules
firebase deploy --only firestore:rules
```

**Important** : v3 garde la backward compat root active. Donc l'ancienne app continue à fonctionner.

### J0 - 12:00 : Tests prod

Tester chez les parents (ou via Chrome MCP) :

| URL | Comportement attendu |
|-----|---------------------|
| `index.html` | Charge legacy (pas de slug) |
| `index.html?resto=marmitte-express` | Charge depuis `restaurants/marmitte-express/` |
| `client.html?table=1&resto=marmitte-express` | Menu charge OK |
| `serveur.html?resto=marmitte-express` | Plan de salle OK |
| `cuisine.html?resto=marmitte-express` | Listen orders/ OK |
| `marmite-express-caisse.html?resto=marmitte-express` | POS encaisse OK |

**Si régression** : rollback rapide via la procédure ci-dessous.

### J+1 → J+6 : Période d'observation

- Monitorer Firebase Console > Firestore > Usage
- Vérifier qu'aucun client ne crée des données dans les collections root via legacy mode
- Garder la backward compat dans rules.v3
- Si bug trouvé : fix + redeploy sans toucher aux données

### J+7 : Suppression définitive root

1. Désactiver backward compat dans `firestore.rules` (supprimer les blocs root)
2. Deploy
3. Supprimer manuellement les collections root via Firebase Console (Firestore > "Delete collection")
4. Tout le trafic doit utiliser `?resto=marmitte-express` désormais

## Rollback

### Étape J0 - 11h (rules v3 cassent un truc)

```bash
cp firestore.rules.backup-v2-* firestore.rules
firebase deploy --only firestore:rules
```

### Étape J0 - 10h (migration corrompt données)

Pas de risque — la migration ne supprime PAS les root. Pour annuler la copie :

1. Firebase Console > Firestore > `restaurants/marmitte-express/` > Delete collection (récursif)
2. L'app retombe sur le legacy mode root

### Récupération depuis backup gcloud

```bash
gcloud firestore import gs://la-marmitte-express-backups/YYYYMMDD
```

## Risques + mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Auth anonyme client QR ne peut plus lire menu | Faible | Élevé (clients bloqués) | Rules.v3 garde lecture publique sur `restaurants/{slug}/config/menu` |
| Migration corrompt données pendant copy | Faible | Élevé | Backup gcloud J-1 + idempotence + ne supprime pas root |
| Cuisinier reçoit pas commandes | Moyen | Élevé | Tester en prod avec un onglet legacy + un onglet multi-tenant en parallèle |
| Deux onglets ouverts en parallèle (un legacy, un slug) écrivent dans deux collections différentes | Moyen | Moyen | Période transition limitée à 7j, rules backward compat permet écriture aux deux |

## Checklist exécution

- [ ] J-1 : `gcloud firestore export gs://...` exécuté + vérifié
- [ ] J0 09:00 : code multi-tenant déployé, GitHub Pages OK
- [ ] J0 10:00 : `migrate-to-multitenant.html` exécuté, rapport meta visible
- [ ] J0 11:00 : `firestore.rules.v3` deployé via `firebase deploy --only firestore:rules`
- [ ] J0 12:00 : tests prod passent (5 URLs)
- [ ] J+1 à J+6 : monitoring sans incident
- [ ] J+7 : rules définitives sans backward compat + suppression collections root

## Voir aussi

- `firestore.rules.v3` (rules cible)
- `migrate-to-multitenant.html` (script migration)
- `assets/js/firebase-sync.multitenant.diff.md` (refacto module client)
- `.planning/phases/03-multi-restaurant/02-PLAN.md` (plan GSD)
