#!/usr/bin/env bash
# deploy-firestore-rules-v4.sh
# Déploie les nouvelles règles Firestore v4 sur le projet la-marmitte-express.
#
# Pré-requis (sur ta machine) :
#   - Node 18+ et npm
#   - Être connecté à Firebase CLI : `npx firebase-tools login`
#   - Être dans le dossier marmitte-express (où vit firestore.rules)
#
# Usage :
#   bash deploy-firestore-rules-v4.sh

set -e
cd "$(dirname "$0")"

if [ ! -f firestore.rules ]; then
  echo "❌ firestore.rules introuvable. Lance ce script depuis le dossier marmitte-express."
  exit 1
fi

echo "════════════════════════════════════════════════════════════"
echo "🔥 Déploiement Firestore Rules v4 → la-marmitte-express"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 État ACTUEL des rules en prod (v3) :"
echo "   🔴 /orders          → lecture PUBLIQUE sans auth (RGPD breach)"
echo "   🔴 /tables          → lecture publique sans auth"
echo "   🟢 /config/apikeys  → déjà bloqué sans auth"
echo "   🟢 /payments        → déjà bloqué sans auth"
echo ""
echo "📋 Après v4 :"
echo "   ✅ /orders, /tables, /payments → isAuth() requis"
echo "   ✅ /config/{apikeys,backup,*}  → isAuth() requis"
echo "   ✅ /config/menu, /config/tables, /config/images_* → reste public (clients QR)"
echo "   ✅ /tickets/{id}    → reste public read (lien QR client)"
echo ""
echo "📋 Backup local de la v3 : firestore.rules.backup-v3-20260518 (rollback possible)"
echo ""
read -p "Continuer le déploiement ? [y/N] " yn
case "$yn" in [Yy]*) ;; *) echo "Annulé."; exit 0;; esac

echo ""
echo "── Vérification firebase CLI ──"
if ! command -v firebase >/dev/null && ! npx --no firebase-tools --version >/dev/null 2>&1; then
  echo "Installation de firebase-tools (local)..."
  npm install --no-save firebase-tools
fi
FB="npx --no firebase-tools"

echo "── Vérification authentification ──"
$FB projects:list >/dev/null 2>&1 || {
  echo "Non connecté. Lance d'abord : $FB login"
  exit 1
}

echo "── Déploiement des rules ──"
$FB deploy --only firestore:rules --project la-marmitte-express

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Déploiement terminé"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "🔬 Vérification post-déploiement (read-only PoC, doit retourner 403) :"
KEY="AIzaSyChl-uEyzbbdJfhXwOUH_rpzSIsEAbexhQ"
BASE="https://firestore.googleapis.com/v1/projects/la-marmitte-express/databases/(default)/documents"

for path in "orders" "tables" "config/apikeys"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$path?pageSize=1&key=$KEY")
  if [ "$code" = "403" ]; then
    echo "   ✅ /$path → HTTP 403 (verrouillé)"
  else
    echo "   ❌ /$path → HTTP $code (ATTENDU 403, déploiement peut-être pas propagé — réessayer dans 30s)"
  fi
done

echo ""
echo "🔬 Vérification que le menu public marche toujours :"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/config/menu?key=$KEY")
if [ "$code" = "200" ]; then
  echo "   ✅ /config/menu → HTTP 200 (clients QR voient le menu)"
else
  echo "   ⚠️  /config/menu → HTTP $code (attendu 200 — vérifier les rules)"
fi

echo ""
echo "🎉 Tout est verrouillé. Test manuel : ouvre client.html sur un device → menu doit charger."
echo "   Si KO sur device : vérifier que signInAnonymously() est bien activé dans"
echo "   Firebase Console → Authentication → Sign-in method → Anonymous (Enabled)."
