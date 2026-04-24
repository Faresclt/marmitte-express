# Sécurité — modèle + procédures

## Modèle à 3 niveaux

| Niveau | Rôle | Mécanisme |
|--------|------|-----------|
| **PIN local** (UX) | Empêche ouverture accidentelle de la caisse par un client | 4 chiffres validés côté client, **pas une sécurité** |
| **Firebase Auth** (identité) | Identifie l'utilisateur côté serveur | UID anonyme via `signInAnonymously()` |
| **Firestore rules** (enforcement) | Rejette les requêtes non autorisées | Exige `request.auth != null` sur collections sensibles |

Le PIN côté client peut être contourné (DevTools). La vraie sécurité est **Firestore rules + Firebase Auth**.

## État actuel (2026-04-24)

- ✅ `firebase-sync.js` fait `signInAnonymously()` au chargement (Phase 2.C.1 fait)
- ⚠️ Firebase Auth anonyme **doit être activé côté Console** (sinon signIn throw → UID null)
- ⚠️ `firestore.rules` actuel laisse `tables/` et `orders/` en écriture **publique** (legacy)
- 📝 `firestore.rules.v2` est prêt (règles strictes) mais pas déployé

## Procédure de bascule vers règles strictes

**Ordre à respecter** (sinon l'app parents se bloque) :

### 1. Activer Firebase Auth anonyme côté Console

```
https://console.firebase.google.com/project/la-marmitte-express/authentication/providers
→ Anonymous → Enable
```

### 2. Tester Auth côté client

Ouvrir la console DevTools sur `index.html` chez les parents. Doit voir :

```
[firebase-sync] Auth anonyme OK, UID: abc123...
```

Si warning "activer dans Firebase Console" → retour étape 1.

### 3. Déployer les règles strictes

```bash
cd marmitte-express-fixed
cp firestore.rules.v2 firestore.rules
firebase deploy --only firestore:rules
```

### 4. Test de régression

- Passer une commande depuis `serveur.html` → doit créer dans `orders/` (auth présente)
- Passer une commande depuis `client.html?table=3` → doit créer dans `orders/` (auth anonyme)
- Ouvrir DevTools Network → vérifier que les requêtes ne renvoient pas 403
- Essayer de poster sans auth (Postman / curl avec token vide) → doit recevoir 403

### 5. Rollback si problème

```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

## Menaces traitées

| Menace | Contre-mesure | Status |
|--------|---------------|--------|
| Injection XSS dans les noms produits | `escHtml()` utilisé partout | ✅ Fait |
| CSP trop permissive | CSP meta dans chaque HTML | ✅ Fait (à tighten en phase 4) |
| Brute-force PIN | Lockout après 5 tentatives | ✅ Fait |
| Écriture `orders/` par un pirate avec l'URL Firebase | Firestore rules (après bascule) | ⚠️ À déployer |
| Écriture `tables/` par un pirate | Firestore rules (après bascule) | ⚠️ À déployer |
| Vol de la clé API Gemini | Clé côté client (acceptable mono-resto) | 🚫 Reporté phase 4 (Cloud Function proxy) |

## Menaces encore ouvertes

- **Pas d'isolation multi-tenant** : un resto peut théoriquement accéder aux données d'un autre s'il connaît le bon ID (pas encore le cas car mono-tenant). Fix en phase 3.
- **Firebase apiKey publique** : normale côté client, la sécurité repose sur les rules Firestore. Pas un risque si rules strictes.
- **Pas de rate limit côté client** : un attaquant pourrait spammer les writes. Mitigation = Firestore rules + billing alerts Google Cloud.

## Audit ponctuel à faire

À chaque ajout de collection Firestore :

1. Définir explicitement les règles dans `firestore.rules`
2. Tester avec compte non-authentifié (doit recevoir 403)
3. Tester avec compte authentifié (doit passer)
4. Documenter ici dans le tableau "Menaces traitées"

## Voir aussi

- `firestore.rules` (actuel, legacy permissif)
- `firestore.rules.v2` (cible, strict)
- `.planning/phases/02-stabilite-fondations/02-PLAN.md` bloc 2.C
- `knowledge-base/projects/marmitte-express/problemes-connus.md` section Sécurité
