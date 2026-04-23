# Phase 5 : Onboarding & Inscription — Plan détaillé

**Created:** 2026-04-21
**Phase:** 5 (dernière)
**Effort estimé:** 3-4 jours

## Découpage en 3 blocs + 11 tâches

### Bloc 5.A — Auth email/password (3 tâches)

#### 5.A.1 Activer email/password dans Firebase Auth
- Firebase Console → Auth → Sign-in method → Email/Password enabled
- Template email de vérification customisé (sujet, corps, lien)
- **Deliverable** : commit "chore(05A): Firebase Auth email/password active"

#### 5.A.2 Migration de l'auth anonyme vers email
- Si un utilisateur anonyme s'inscrit : `linkWithCredential()` pour garder l'UID
- Permet au resto des parents (actuellement anonyme) de "s'inscrire" sans perdre ses données
- **Deliverable** : commit "feat(05A): migration anonyme → email/password"

#### 5.A.3 Page de connexion pour restos existants
- `login.html` : form email + password
- Récupération mot de passe oublié (Firebase natif)
- Redirect vers `caisse.html?resto=slug` après login
- **Deliverable** : commit "feat(05A): login.html"

### Bloc 5.B — Wizard d'inscription 7 étapes (6 tâches)

#### 5.B.1 Structure `register.html`
- Container wizard avec steps indicator (7 étapes)
- Animation slide entre étapes
- Bouton "Suivant" désactivé tant que validation KO
- Sauvegarde progressive dans localStorage (reprise si interruption)
- **Deliverable** : commit "feat(05B): structure wizard register.html"

#### 5.B.2 Étape 1 — Type cuisine
- Grille 8 cards visuelles (brasserie / pizzeria / tapas / asiatique / bistrot / fusion / vegan / autre)
- Au clic : persiste `cuisine` en localStorage + **lance en arrière-plan la génération des 10 images menu démo** (Cloud Function `generateImage` x 10 en batch)
- **Deliverable** : commit "feat(05B): étape 1 type cuisine + kickoff génération images"

#### 5.B.3 Étape 2 — Compte
- Form email + password + confirmation
- Validation client (regex email, longueur password 8+)
- `createUserWithEmailAndPassword(auth, email, password)` + envoi email vérification
- **Deliverable** : commit "feat(05B): étape 2 création compte"

#### 5.B.4 Étape 3 — Identité resto
- Form : nom (obligatoire), slug (auto-généré depuis nom, éditable, check unicité Firestore), tagline (optionnel), description (optionnel), adresse (avec géocoding → lat/lng)
- Crée le document `restaurants/{slug}/branding/identity`
- **Deliverable** : commit "feat(05B): étape 3 identité resto"

#### 5.B.5 Étapes 4 + 5 — Branding + Photos
- Étape 4 : logo upload (skip OK) + couleur accent (default = orange par type cuisine)
- Étape 5 : 3 photos d'ambiance (upload OU generation IA auto basée sur type cuisine)
- Les 2 étapes skip-able
- **Deliverable** : commit "feat(05B): étapes 4-5 branding + photos"

#### 5.B.6 Étapes 6 + 7 — Menu démo + Plan de salle
- Étape 6 : affiche les 10 plats pré-remplis avec images (lancées à l'étape 1 → prêtes maintenant). Éditable (renommer, supprimer, ajouter)
- Étape 7 : grille 4x2 de tables, éditable (drag pour déplacer, bouton pour ajouter/supprimer)
- Bouton final "Terminer" → redirect `caisse.html?resto={slug}&welcome=true`
- **Deliverable** : commit "feat(05B): étapes 6-7 menu démo + plan salle"

### Bloc 5.C — Tour guidé + monitoring (2 tâches)

#### 5.C.1 Tour guidé première visite
- Si `?welcome=true` : overlay avec tour en 5 points (admin, commande, cuisine, caisse, perso)
- Stocke `visited` en localStorage pour ne pas réafficher
- **Deliverable** : commit "feat(05C): tour guidé bienvenue"

#### 5.C.2 Monitoring onboarding (analytics simple)
- Log Firestore : `restaurants/{slug}/onboarding/` avec timestamps par étape
- Permet d'identifier où les restos drop-out
- **Deliverable** : commit "feat(05C): tracking onboarding"

## Seed menu démo (data)

Créer `data/demo-menus.json` avec 8 catégories type cuisine × 10 plats :

```json
{
  "brasserie": [
    {"name": "Entrecôte frites", "price": 22.00, "cat": "plats", "desc": "Entrecôte 300g, frites maison, sauce au poivre"},
    ...
  ],
  "pizzeria": [...],
  "tapas": [...],
  ...
}
```

Chaque plat sera complété par une image IA générée à la volée dès l'étape 1 du wizard.

## Success criteria

- [ ] Un nouveau resto complète l'inscription en < 10 minutes (chrono réel)
- [ ] Les 10 images menu sont générées pendant l'inscription (pas après)
- [ ] Compte créé → email vérification reçu
- [ ] Redirect `caisse.html?resto=slug` fonctionne avec tour guidé
- [ ] Reprise possible si interruption (données localStorage)
- [ ] Slug unique garanti (check Firestore)
- [ ] Drop-out trackés par étape

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Cloudflare Workers AI saturé pendant l'inscription | Images menu absentes | Fallback Pollinations + placeholder si échec total |
| Utilisateur quitte au milieu | Données perdues | Sauvegarde localStorage à chaque étape, reprise automatique |
| Slug déjà pris | Bloqué à l'étape 3 | Suggestions auto (`nom-ville`, `nom-1`, etc.) |
| Email déjà utilisé | Bloqué à l'étape 2 | Propose "Se connecter" à la place |

## Voir aussi

- Hub Obsidian : `knowledge-base/projects/marmitte-express/phase-05-onboarding.md`
- Prérequis phases 2-4 (voir leurs dossiers `.planning/phases/`)
