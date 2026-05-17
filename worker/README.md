# Email Worker — Setup pour le restaurateur

Ce mini-serveur gratuit permet à votre caisse d'envoyer **jusqu'à 9000 tickets par email gratuitement chaque mois** (Brevo Free).

Setup en **15 minutes**, une seule fois. Aucune compétence technique requise.

---

## 1. Créer un compte Brevo (gratuit, sans CB)

1. Allez sur [brevo.com](https://www.brevo.com) → **Sign up free**.
2. Renseignez votre nom, email pro et le nom du restaurant.
3. Confirmez votre email.
4. Dans le menu de gauche : **SMTP & API** → onglet **API Keys** → **Generate a new API key**.
   - Nom : `caisse-marmite`
   - Copiez la clé (commence par `xkeysib-…`) et **gardez-la quelque part en sécurité** — vous ne pourrez plus la revoir.
5. Vérifiez votre email expéditeur : **Senders, Domains & Dedicated IPs** → **Senders** → **Add a sender** → entrez l'email d'envoi (ex. `contact@votre-resto.fr`). Brevo vous envoie un mail de confirmation, cliquez sur le lien.

---

## 2. Créer un compte Cloudflare (gratuit, sans CB)

1. Allez sur [cloudflare.com](https://dash.cloudflare.com/sign-up) → créez un compte.
2. Confirmez votre email.

---

## 3. Déployer le Worker (5 minutes)

1. Dans le tableau de bord Cloudflare, cliquez sur **Workers & Pages** dans le menu de gauche.
2. **Create application** → **Create Worker**.
3. Donnez-lui un nom : `caisse-marmite-mailer` (ou ce que vous voulez).
4. **Deploy** (un Worker vide se déploie).
5. Cliquez sur **Edit code** (icône `</>` ou bouton "Quick edit").
6. **Supprimez tout le code par défaut**.
7. Ouvrez le fichier [`brevo-mailer.js`](./brevo-mailer.js) dans ce repo, **copiez tout le contenu**, **collez-le** dans l'éditeur Cloudflare.
8. Cliquez sur **Save and Deploy**.
9. Notez l'URL du Worker affichée tout en haut, du genre : `https://caisse-marmite-mailer.VOTRE-USERNAME.workers.dev`

---

## 4. Configurer les variables d'environnement

1. Dans la page du Worker → onglet **Settings** → **Variables and Secrets**.
2. Ajoutez **4 variables** (cliquez sur "Add variable" pour chacune) :

| Nom | Valeur | Type |
|-----|--------|------|
| `BREVO_API_KEY` | `xkeysib-…` (votre clé de l'étape 1.4) | **Secret** (chiffré) |
| `SENDER_EMAIL` | L'email expéditeur vérifié à l'étape 1.5 | Texte |
| `SENDER_NAME` | Nom affiché, ex. `La Marmite Express` | Texte |
| `ALLOWED_ORIGIN` | URL exacte de votre caisse, ex. `https://faresclt.github.io` | Texte |

3. **Save and Deploy** après chaque ajout (ou tous d'un coup en haut).

---

## 5. Connecter la caisse au Worker

1. Sur votre tablette de caisse → **Admin → Paramètres**.
2. Section **📧 Envoi des tickets par email**.
3. Collez l'URL du Worker (étape 3.9) dans le champ **URL du Worker email**.
4. Collez l'email expéditeur (étape 1.5) dans **Email expéditeur**.
5. Cliquez sur **Tester l'envoi** avec votre propre email pour vérifier que ça marche.

---

## En cas d'erreur

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Server misconfigured: BREVO_API_KEY missing` | Variable non définie dans Worker | Refaire étape 4 |
| `unauthorized` retourné par Brevo | Clé API invalide ou révoquée | Régénérer la clé dans Brevo |
| `Sender not allowed` | Email expéditeur non vérifié | Refaire étape 1.5 |
| `CORS error` côté caisse | `ALLOWED_ORIGIN` mal configuré | Mettez exactement l'URL d'origine de la caisse (sans `/` final) |
| Aucun email reçu | Spam | Vérifiez les indésirables, et configurez SPF/DKIM dans Brevo (Senders → onglet Authentication) |

---

## Quotas

- **Brevo Free** : 300 emails/jour, soit ~9000/mois. Pas d'expiration.
- **Cloudflare Workers Free** : 100 000 requêtes/jour. Largement suffisant.

Au-delà : Brevo Starter à 9€/mois pour 5000 emails/mois, ou conservez plusieurs workers/comptes pour différents restos.
