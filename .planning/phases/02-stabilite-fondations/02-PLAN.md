# Phase 2 : Stabilité & Fondations — Plan détaillé

**Created:** 2026-04-21
**Phase:** 2 (1er dans l'ordre d'exécution)
**Effort estimé:** 3-5 jours de travail concentré

## Progression

**Commits phase 2** (au 2026-04-24) :
- [x] `2bda090` — 2.A.1 + 2.A.2 : structure `assets/` + module `firebase-sync.js`
- [x] `6497ab6` — 2.A.3 (6/7 pages) : migration index, serveur, client, cuisine, qrcodes, setup-images
- [ ] 2.A.3 (caisse) + 2.A.4 + 2.A.5 : refactor marmite-express-caisse.html — **à faire avec tests manuels chez les parents**
- [ ] 2.A.6 + 2.B + 2.C + 2.D : reste du plan

**Avant de continuer le refactor caisse** : Fares doit vérifier chez les parents que les 6 pages migrées fonctionnent toujours (menu client QR, prise commande serveur, dashboard cuisine, génération QR, setup images). Les pages ne chargent plus leur propre config Firebase — elles passent par `assets/js/firebase-sync.js`. Si GitHub Pages déploie bien les sous-dossiers, tout doit fonctionner identique à avant.

## Découpage en 4 blocs + 18 tâches atomiques

### Bloc 2.A — Refactor architecture (6 tâches)

#### 2.A.1 Préparer la structure de dossiers ✅ FAIT (commit 2bda090)
- Créer `assets/css/` et `assets/js/`
- Créer les fichiers vides : `design-system.css`, `caisse.css`, `firebase-sync.js`, `pos.js`, `admin.js`
- Ajouter `.gitkeep` si nécessaire
- **Deliverable** : commit "chore(02A): structure assets/css et assets/js"
- **Test** : `ls assets/css/` et `ls assets/js/` retournent les fichiers

#### 2.A.2 Extraire Firebase init dans `firebase-sync.js` ✅ FAIT (commit 2bda090)
- Copier la config Firebase + `initializeApp` + `getFirestore` depuis les 5 pages
- Exposer : `export const db`, `export const auth`, `export function getCollection(name)`
- **Deliverable** : commit "feat(02A): module firebase-sync centralise l'init Firebase"
- **Test** : ouvrir `setup-images.html` (le plus simple), remplacer son init par l'import du module, vérifier que la page se charge et que Firestore lit les produits

#### 2.A.3 Migrer les autres pages vers `firebase-sync.js` ⚠️ PARTIEL (commit 6497ab6)
- [x] `index.html` → migré
- [x] `serveur.html` → migré
- [x] `client.html` → migré
- [x] `cuisine.html` → migré
- [x] `qrcodes.html` → migré
- [x] `setup-images.html` → migré
- [ ] `marmite-express-caisse.html` → **reporté à 2.A.5** (traité avec extraction JS/CSS)
- **Test** : ouvrir chaque page, passer une commande complète (serveur → cuisine → caisse), vérifier la sync

#### 2.A.4 Extraire le CSS de la caisse
- Créer `design-system.css` avec UNIQUEMENT les `:root` CSS variables (pas de classes, juste les tokens — le vrai design system viendra en phase 1)
- Créer `caisse.css` avec tous les styles spécifiques du POS (extrait du `<style>` inline de `marmite-express-caisse.html`)
- Ajouter les `<link rel="stylesheet">` dans le HTML
- **Deliverable** : commit "refactor(02A): CSS caisse extrait dans assets/css/"
- **Test** : ouvrir la caisse, comparer visuellement avec la version précédente (pas de régression pixel-perfect mais toutes les sections doivent être identiques)

#### 2.A.5 Extraire le JS de la caisse (POS + Admin)
- Créer `pos.js` avec la logique : commandes, encaissement, TVA, division de note, historique
- Créer `admin.js` avec : CRUD produits, catégories, config, plan de salle
- Utiliser `import/export` ES modules
- `marmite-express-caisse.html` devient une coquille qui importe les modules en `<script type="module">`
- **Deliverable** : commit "refactor(02A): JS caisse extrait dans pos.js + admin.js"
- **Test** : parcourir tous les flows de la caisse (encaissement complet, division de note, ajout produit, configuration TVA, etc.)

#### 2.A.6 Audit post-refactor
- Vérifier que `marmite-express-caisse.html` est passé de 251 KB à < 30 KB (coquille + inline minimum)
- Vérifier qu'il n'y a pas de duplication entre les pages
- **Deliverable** : commit "docs(02A): post-refactor audit" avec un README expliquant la nouvelle structure
- **Test** : `wc -l` sur les fichiers JS, s'assurer qu'aucun fichier JS ne dépasse 1000 lignes

### Bloc 2.B — Gestion d'état (5 tâches)

#### 2.B.1 Documenter les 10 migrations DATA_VERSION
- Créer `docs/DATA_MIGRATIONS.md`
- Pour chaque version 1→10 : date, motif, changements de schéma, compatibilité arrière
- **Deliverable** : commit "docs(02B): historique des migrations DATA_VERSION"

#### 2.B.2 Implémenter la queue de sync
- Dans `firebase-sync.js` : ajouter une queue `syncQueue` (array d'opérations en attente)
- Chaque opération : `{type: 'set'|'update'|'delete', collection, docId, data, timestamp, retries}`
- Exposer `queueOp(op)` qui push dans la queue + persist dans localStorage pour survie au reload
- **Deliverable** : commit "feat(02B): queue de sync localStorage → Firestore"
- **Test** : couper Firestore (firewall), faire 3 opérations, vérifier que la queue contient 3 items

#### 2.B.3 Retry avec exponential backoff
- Processeur de queue qui tente chaque op avec backoff (1s, 2s, 4s, 8s, 16s, 30s max)
- Si succès → retirer de la queue
- Si échec persistant (> 5 retries) → mettre en "failed", alerter l'admin
- **Deliverable** : commit "feat(02B): retry exponential backoff sur la queue"
- **Test** : simuler panne réseau 10s, vérifier que les ops passent au retour

#### 2.B.4 UI de statut de sync
- Banner en bas de page (toutes les pages) qui indique :
  - État connexion : "En ligne" / "Hors ligne"
  - Queue : "N opérations en attente de sync" si > 0
  - Dernière sync : timestamp
- Couleurs : vert (OK), jaune (queue non vide), rouge (hors ligne)
- **Deliverable** : commit "feat(02B): banner statut sync sur toutes les pages"

#### 2.B.5 Migration des données existantes
- S'assurer que tout ce qui est en localStorage du resto des parents se synchronise correctement en Firestore
- Script one-shot `migrate-v10-to-v11.html` si nécessaire (DATA_VERSION bump)
- **Deliverable** : commit "feat(02B): migration DATA_VERSION 10 → 11 (sync hardening)"
- **Test** : exécuter chez les parents, vérifier qu'aucune donnée n'est perdue

### Bloc 2.C — Sécurité (4 tâches)

#### 2.C.1 Activer Firebase Auth anonyme
- Dans Firebase Console : activer "Sign-in method" anonyme
- Dans `firebase-sync.js` : `signInAnonymously(auth)` au chargement de chaque page
- Stocker l'UID dans localStorage pour persistance
- **Deliverable** : commit "feat(02C): Firebase Auth anonyme active"
- **Test** : ouvrir n'importe quelle page, vérifier dans DevTools Firebase qu'un UID est créé

#### 2.C.2 Lier le PIN local à l'UID Firebase
- Le PIN reste pour l'UX (rapide), mais il est validé côté client PUIS un claim est écrit dans le token Firebase
- Côté Firestore : les règles exigent `request.auth.uid != null` (ne valident PAS le PIN — le PIN c'est juste UX pour éviter d'ouvrir la caisse par accident)
- **Deliverable** : commit "refactor(02C): PIN lié à l'UID Firebase (UX only)"

#### 2.C.3 Réécrire `firestore.rules`
- Collections RÉELLES (vérifié 2026-04-22) : `config/`, `tables/`, `orders/`, `payments/`
- Règles cibles :
  ```
  match /config/{docId} {
    allow read: if docId != 'apikeys';
    allow read: if docId == 'apikeys' && request.auth != null;
    allow write: if request.auth != null;
  }
  match /tables/{id}   { allow read: if true; allow write: if request.auth != null; }
  match /orders/{id}   { allow read: if true; allow create, update: if request.auth != null; allow delete: if request.auth != null; }
  match /payments/{id} { allow read, write: if request.auth != null; }
  ```
- Changement clé : `tables/` et `orders/` passent de write public → write auth
- Menu client (`config/menu`) reste lisible sans auth (nécessaire pour QR code)
- Tester avec Firebase Emulator OU en prod avec compte non-authentifié → 403 attendu
- **Deliverable** : commit "feat(02C): firestore.rules strictes (auth required sur tables+orders)"
- **Test** : curl non-authentifié POST sur `orders/` → 403

#### 2.C.4 Documenter la sécurité
- Créer `docs/SECURITY.md` qui explique : PIN = UX, Auth = sécurité, rules = enforcement
- Lister les menaces traitées et celles encore ouvertes (clé Gemini côté client = reporté phase 4)
- **Deliverable** : commit "docs(02C): modèle de sécurité documenté"

### Bloc 2.D — Offline réel (3 tâches)

#### 2.D.1 Activer IndexedDB persistence
- Dans `firebase-sync.js` : `enableIndexedDbPersistence(db)` en try/catch (peut échouer si plusieurs onglets)
- Gérer le cas "multiple tabs" avec `enableMultiTabIndexedDbPersistence()` si utile
- **Deliverable** : commit "feat(02D): Firestore IndexedDB persistence activée"
- **Test** : DevTools → Network → Offline → rafraîchir la page → les données Firestore précédemment chargées sont encore visibles

#### 2.D.2 POS offline
- Vérifier que l'encaissement + ajout commande fonctionnent sans internet (grâce à 2.B + 2.D.1)
- Les écritures Firestore sont automatiquement queuées via IndexedDB
- Afficher l'indicateur "Offline" quand `navigator.onLine === false`
- **Deliverable** : commit "feat(02D): POS fonctionne offline"
- **Test** : couper internet en plein service simulé, passer une commande + encaisser, remettre internet, vérifier que tout remonte en Firestore

#### 2.D.3 Tests manuels de régression
- Dérouler un script de test complet (cf. checklist ci-dessous)
- Corriger les régressions trouvées
- **Deliverable** : commit "test(02D): régression validée"

## Checklist de régression (test manuel final)

### Flow serveur
- [ ] Ouvrir `serveur.html`, se connecter par PIN
- [ ] Prendre une commande avec plusieurs produits, variantes, cuissons
- [ ] Envoyer en cuisine, vérifier qu'elle apparaît dans `cuisine.html`

### Flow client
- [ ] Scanner QR code d'une table, ouvrir `client.html?table=N`
- [ ] Naviguer les catégories, ajouter au panier
- [ ] Envoyer la commande, vérifier qu'elle apparaît en cuisine

### Flow cuisine
- [ ] Recevoir une commande (son + animation `lateFlash`)
- [ ] Lecture vocale (`speechSynthesis`) fonctionne
- [ ] Déplacer dans les 3 colonnes (En attente / En cours / Prêt)

### Flow caisse
- [ ] Ouvrir `marmite-express-caisse.html`, se connecter par PIN
- [ ] Encaissement simple (espèces)
- [ ] Encaissement avec CB (TVA 10% et 20%)
- [ ] Division de note (3 personnes)
- [ ] Consultation historique
- [ ] Ajouter un produit (admin)
- [ ] Modifier plan de salle (drag/drop)

### Flow offline
- [ ] Couper internet
- [ ] Encaisser une commande offline
- [ ] Remettre internet
- [ ] Vérifier que l'opération remonte en Firestore

### Flow auth
- [ ] Ouvrir une page en mode incognito
- [ ] Vérifier qu'un UID anonyme est créé automatiquement
- [ ] Tester les règles Firestore avec un token vide → 403

## Success criteria (Phase 2 validée)

- [ ] `marmite-express-caisse.html` < 30 KB (vs 251 KB avant)
- [ ] Zéro duplication Firebase init entre pages
- [ ] Queue de sync opérationnelle avec retry exponential backoff
- [ ] Banner état sync visible sur toutes les pages
- [ ] Firebase Auth anonyme actif, règles Firestore strictes testées
- [ ] POS fonctionne offline avec sync au retour
- [ ] Toute la checklist de régression passe

## Risques + mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Casser l'app en prod chez les parents | CA perdu | Faire le refactor sur une branche, tester en local avec Firebase Emulator, déployer pendant les heures creuses |
| Bug de sync introduit par la queue | Données perdues | Backup Firestore avant migration, test approfondi en local |
| Règles Firestore trop strictes (blocage menu client) | Clients ne voient plus le menu | Test en navigation privée avant déploiement |
| IndexedDB échoue dans certains navigateurs | Pas d'offline | Fallback gracieux (warning si indisponible, pas de crash) |

## Voir aussi

- Hub Obsidian : `knowledge-base/projects/marmitte-express/phase-02-stabilite.md`
- Audit qui motive cette phase : `knowledge-base/projects/marmitte-express/audit-2026-04-21.md`
