# Audit demandé : page `setup-images.html` de **La Marmite Express**

> Bonjour Antigravity, j'ai besoin d'un second avis sur une page d'un projet en
> cours. Ce document est **autosuffisant** : tu n'as pas besoin de connaître
> le reste du projet pour répondre. Voici tout le contexte.

---

## 1. Contexte produit

**La Marmite Express** est une application web (PWA) de **caisse pour restaurant**,
fonctionnant entièrement dans le navigateur. Pas de backend custom — uniquement
Firebase (Firestore) pour la synchro temps réel entre les devices (PC du
restaurant + iPhones des serveurs en salle).

L'app contient :
- `marmite-express-caisse.html` : la caisse principale (PC en cuisine/comptoir)
  → encaisse, gère le plan de salle, l'historique, le CA…
- `marmite-express-serveur.html` : interface mobile pour les serveurs
- `index.html` : page d'accueil publique avec la carte
- **`setup-images.html`** : **la page qu'on audite**

L'utilisateur final est un **restaurateur seul** qui configure son menu une
fois pour toutes (62 produits typiques : boissons, bières, vins, entrées,
plats, salades, desserts) et veut une **belle photo pour chaque produit** sur
sa carte client et dans sa caisse.

---

## 2. À quoi sert `setup-images.html` ?

C'est un **outil one-shot de bootstrap visuel** : il permet au restaurateur de
peupler les images de ses 62 produits **en une seule session**, sans avoir à
prendre/uploader 62 photos une par une depuis l'écran d'édition produit de la
caisse.

Deux mécanismes :

1. **Import en masse depuis un dossier** : l'utilisateur glisse un dossier
   (typiquement extrait d'un ZIP) et les fichiers sont mappés aux produits
   par fuzzy-match sur le nom de fichier (`coca.jpg` → produit "Coca-Cola").

2. **Génération IA** : pour les produits sans image, génère des photos
   stylisées via une API d'image generation (Pollinations.ai gratuit par
   défaut, Recraft.ai en option premium).

Les images sont stockées en **base64 dans le localStorage du navigateur**,
puis publiées vers Firebase Storage via un bouton "Publier la carte" depuis
la caisse principale. Le flow attendu est :

```
Restaurateur ouvre setup-images.html
    ↓
Étape 1 : import dossier (boissons → 36 images mappées en dur)
    ↓
Étape 2 : choisit un style (Brasserie / Minimal / Rustique / Streetfood)
       + choisit le provider (Pollinations gratuit / Recraft premium)
       + clic "Générer toutes les images manquantes"
    ↓
60-90 secondes de génération (1 image / 1.5s)
    ↓
Étape 3 : clic "✓ Sauvegarder dans localStorage"
    ↓
Va dans la caisse → "☁️ Publier la carte" pour pousser sur Firebase
    ↓
Les images apparaissent partout (POS, page client, app serveur)
```

---

## 3. Architecture technique de la page

- **Frontend pur** : HTML/CSS/JS, ES module pour l'import Firestore
- **Sync produits temps réel** depuis Firestore `config/menu.products`
- **Génération IA** :
  - Pollinations.ai (gratuit, sans clé) : `image.pollinations.ai/prompt/...`
    → renvoie un PNG 1024×1024 — retry 3× avec backoff exponentiel
  - Recraft.ai : `external.api.recraft.ai/v1/images/generations` avec
    `Authorization: Bearer <key>` → 50 crédits gratuits/mois
- **Stockage** : `localStorage` (clé `img_<slug_du_nom>`)
- **Compression** : `compressImg(maxW=600, q=0.82)` → JPEG ~50 KB par image
- **4 styles de prompts** soignés et différenciés (extraits) :
  - Brasserie : "wet dark charcoal slate stone surface… warm amber backlighting"
  - Minimal : "pure white marble… Scandinavian restaurant"
  - Rustique : "weathered dark oak wooden table… countryside bistro"
  - Streetfood : "dramatic neon-like colored lighting… urban graffiti wall"

La page fait **873 lignes** dont ~660 de JS dans un seul `<script type="module">`.

---

## 4. Workflow utilisateur réel (avec frictions)

> Mise en situation : le restaurateur a 62 produits, dont des photos pro pour
> les boissons (fournies par ses fournisseurs dans un ZIP) mais rien pour les
> plats qu'il cuisine.

1. Il ouvre `setup-images.html` → voit 4 stats (Produits / Avec image / Sans
   image / Générées IA).
2. **Étape 1 — Import dossier** : il sélectionne le dossier des boissons.
   ✅ Marche bien pour les 36 boissons mappées (Coca, Heineken, vin rouge…).
   ❌ S'il a aussi des photos de plats dans le dossier → ignorées
   silencieusement avec log `? burger.jpg — non mappé`.
3. **Étape 2 — Génération IA** : il choisit un style (Brasserie par défaut),
   coche "🍽️ Plats / Entrées / Salades / Desserts" (Boissons décochées car
   déjà importées), clique "🎨 Générer toutes les images manquantes".
   → Boucle de 60-90s avec une barre de progression et un log live.
4. **Affichage** : grille de 62 cartes avec preview de chaque image, badge
   ✓/! pour avec/sans image. Click sur une carte = modal preview avec
   bouton "🎨 Régénérer" (si une image ne plaît pas) et "🗑 Supprimer".
5. **Sélection ciblée** : barre d'outils pour cocher des produits spécifiques
   et "🎨 Générer la sélection" (par exemple pour régénérer les 3 plats
   qui n'ont pas bien rendu).
6. **Étape 3 — Sauvegarder** : clic obligatoire sur "✓ Sauvegarder dans
   localStorage" sinon **tout est perdu au reload**.
7. Il clique "→ Ouvrir la Caisse" puis dans la caisse "☁️ Publier" pour
   pousser sur Firebase Storage et synchroniser tous les devices.

---

## 5. 🔴 Bugs critiques identifiés

### Bug 1 : `window.generateSelected` défini **DEUX FOIS** (lignes 514 et 570)
La 2e définition écrase la 1re. La 1re version (la "morte") contenait un
auto-clear de la sélection à la fin et un increment du stat `stat-gen`.
La 2e (utilisée) ne le fait pas. Bug de refactoring incomplet.

### Bug 2 : `runGeneration` défini **DEUX FOIS** avec signatures différentes (lignes 579 et 657)
- 1re : `runGeneration(targets, mode)` → respecte la sélection passée
- 2e (écrase) : `runGeneration(genProducts)` → **re-filtre les "missing only"** ligne 678

**Conséquence concrète et grave** : quand l'utilisateur coche un produit qui
a déjà une image et clique "Générer la sélection" pour la régénérer,
l'image existante **n'est jamais régénérée** car le re-filter l'élimine.
Soit ça affiche silencieusement "Tous les produits ont déjà une image"
alors qu'on a délibérément coché 5 produits dont 3 sans image et 2 avec.
Le restaurateur ne comprend pas pourquoi son "Régénérer" ne fait rien.

### Bug 3 : Quota localStorage va exploser silencieusement
Les images **générées par IA** ne passent **pas** par `compressImg`. Ligne 480
on a directement `r.readAsDataURL(blob)` sur le PNG 1024×1024 brut de
Pollinations → ~1-2 MB par image en base64.

Sur 60 produits → **60-120 MB**. Le quota localStorage navigateur est de
5-10 MB selon le navigateur. La saturation arrive après ~5-7 images.

Le handler `LS.set` fait juste `alert('Stockage plein')` sans cleanup ni
recovery → **le restaurateur perd tout ce qu'il a déjà généré**.

A contrario, le flow d'import dossier utilise bien `compressImg(600, 0.85)`
qui donne du ~50 KB par image → 60 × 50 KB = 3 MB → OK. C'est juste le flow
IA qui est cassé.

### Bug 4 : Code mort Gemini partout
Le `<select id="ia-provider">` lignes 115-118 ne propose plus que
`pollinations` et `recraft`. Mais le code traîne 5 endroits avec
`provider === 'gemini'` :
- `toggleProviderKey()` ligne 439 — branche `else if (provider === 'gemini')` jamais atteinte
- `runGeneration` ligne 700 — bloc entier d'appel à
  `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent`
  qui ne sera jamais déclenché
- `regenImage` ligne 816 — `throw new Error('Gemini removed')` jamais atteint
- ~60 lignes de code mort qui prêtent à confusion lors de la maintenance

---

## 6. 🟡 Limitations sérieuses (pas des bugs mais friction UX)

### Limitation 1 : Import dossier ne marche que pour 36 boissons hardcodées
`FILE_MAP` lignes 231-268 contient un mapping manuel de 36 entrées :
```js
const FILE_MAP = {
  'soda': 'p1', 'coca': 'p1',
  'sirop': 'p2', 'menthe': 'p2',
  // ... 34 autres lignes pour les boissons uniquement
  'champagne': 'p36',
};
```

Pour les ~26 plats/desserts/salades/entrées : **impossible d'importer ses
propres photos par dossier**. L'utilisateur doit soit générer en IA (qualité
incertaine, et le résultat IA d'un "burger maison" ne reflète pas son plat
réel), soit aller dans la caisse → produit → upload manuel un par un.

C'est dommage car la promesse de la page c'est justement "import en masse".

### Limitation 2 : Sauvegarde manuelle = risque de perte de travail
L'utilisateur doit cliquer **explicitement** "✓ Sauvegarder dans localStorage"
pour persister. S'il ferme l'onglet ou recharge la page avant → tout ce qu'il
a généré (potentiellement 90 secondes de génération IA payante avec Recraft)
est perdu. Pas d'auto-save, pas de "vous avez du travail non sauvegardé"
au `beforeunload`.

### Limitation 3 : Aucune confirmation avant génération massive
Clic accidentel sur "Générer toutes les images manquantes" sur 60 produits
= 90 secondes de génération bloquantes + 60 appels API. Aucun
`confirm("Confirmer la génération de 60 images ?")`.
Si l'API est Recraft (premium payant), ça consomme des crédits sans
demander confirmation.

### Limitation 4 : `p52` exclu en dur (ligne 651)
```js
const filtered = PRODUCTS.filter(p => allowedCats.includes(p.cat) && p.id !== 'p52');
```
Un produit spécifique skippé sans commentaire. Si l'utilisateur renomme,
supprime ou réorganise le menu, ce filtre devient absurde voire dangereux.
Pourquoi `p52` ? Anti-pattern de hardcoding métier sans contexte.

### Limitation 5 : Double-stockage `setImg(id)` ET `setImg(name)`
Ligne 755-756 :
```js
setImg(id, b64);     // clé img_p7
setImg(prod.name, b64); // clé img_san_pellegrino
```
Stocke 2× la même image. Quota gaspillé ×2 ; si le produit est renommé dans
la caisse après, la copie par-nom devient orpheline et reste à vie dans le
localStorage.

---

## 7. 🟢 Ce qui marche bien

- **Sync Firestore temps réel** des produits (ligne 217) → toujours à jour
  avec le menu actuel, gestion des doublons via `Set`
- **4 styles de prompts** soignés et bien différenciés (Brasserie / Minimal /
  Rustique / Streetfood), avec variantes food/drink et flag `isCold` pour
  les desserts (pas de vapeur)
- **Pollinations gratuit par défaut** = barrière d'entrée à zéro
- **Preview modal** avec régénération à la demande et bouton suppression
- **UI cohérente** avec le design system du reste de l'app (CSS vars,
  même palette de couleurs)
- **Retry 3× avec backoff exponentiel** sur Pollinations (`genViaPollinations`
  ligne 482, attempts 2s/4s/6s)
- **Persistance des clés API par provider** dans localStorage
  (`recraft_api_key`, `gemini_api_key`, `ia_provider_choice`)
- **Sélection ciblée** : checkboxes par produit pour ne régénérer qu'une
  partie des images (bonne UX, juste cassée par le bug 2)
- **Rate limiting** : `await sleep(1500)` entre chaque requête API

---

## 8. Recommandations envisagées (mais pas encore implémentées)

1. **Fix runGeneration / generateSelected** : virer les doublons, garder une
   seule version qui respecte vraiment la sélection (que le produit ait
   déjà une image ou non — l'utilisateur a explicitement coché pour
   régénérer)
2. **Compresser les images IA** avant stockage (faire passer le résultat de
   `genViaPollinations` par `compressImg(600, 0.82)`) → divise la taille
   par 10-20
3. **Auto-save** après chaque génération réussie (suppression du bouton
   manuel "Sauvegarder dans localStorage")
4. **Confirmation** avant génération massive (>5 produits) avec preview du
   coût (nb de requêtes API)
5. **Élargir l'import dossier** aux plats via fuzzy-match sur les noms de
   produits du Firestore (au lieu du `FILE_MAP` rigide), avec
   normalisation accent/ponctuation
6. **Virer le code mort Gemini** (~60 lignes)
7. **Détection quota** : si localStorage proche de la limite, alerter +
   proposer cleanup des images orphelines (produits supprimés du menu)
8. **`beforeunload`** si du travail non sauvegardé (si on garde le bouton
   manuel)
9. **Supprimer le double-stockage** `setImg(name)` qui doublonne `setImg(id)`
10. **Supprimer le filter `p.id !== 'p52'`** (anti-pattern hardcodé)

---

## 9. Questions concrètes pour toi, Antigravity

1. **Est-ce que le verdict global est juste ?** Suis-je trop dur ou au
   contraire suis-je passé à côté d'un problème plus grave ?
2. **Sur le bug 3 (quota localStorage)** : est-ce qu'on devrait carrément
   abandonner localStorage et stocker directement dans Firebase Storage
   au fur et à mesure de la génération, plutôt que faire un staging en
   localStorage ? Pros/cons ?
3. **Sur la limitation 1 (import dossier limité aux boissons)** : un
   fuzzy-match basé sur Levenshtein ou trigrams sur les noms de produits
   serait-il robuste pour des dossiers contenant "poulet_curry_v2.jpg",
   "Poulet au curry FINAL.png", "burger_maison.jpeg" ? Ou faut-il une
   approche plus intelligente (vision LLM pour matcher l'image au plat) ?
4. **Architecturalement** : la page fait 873 lignes monolithiques. Vaut-il
   le coup de la découper en modules ES, ou c'est overkill pour un outil
   one-shot utilisé 1 fois par le restaurateur ?
5. **Auto-save vs save manuel** : sachant qu'écrire dans localStorage
   à chaque image générée multiplie les I/O, est-ce risqué pour les
   perfs / la fiabilité ? Ou totalement négligeable ?
6. **As-tu d'autres bugs ou anti-patterns que j'ai ratés ?** Le code complet
   de la page est dans le repo si tu peux le lire, sinon les portions
   critiques sont citées ci-dessus avec numéros de ligne.

Merci pour ton avis.
