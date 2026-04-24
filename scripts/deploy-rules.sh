#!/usr/bin/env bash
# deploy-rules.sh — bascule firestore.rules.v2 vers firestore.rules et déploie
#
# Usage :
#   bash scripts/deploy-rules.sh
#
# Prérequis :
#   1. firebase-tools installé (`npm install -g firebase-tools`)
#   2. `firebase login` (OAuth Google, s'ouvre dans le navigateur)
#   3. Firebase Auth anonyme activé côté Console :
#      https://console.firebase.google.com/project/la-marmitte-express/authentication/providers
#      → Anonymous → Enable

set -e

cd "$(dirname "$0")/.."

echo "→ Vérification firebase-tools..."
firebase --version > /dev/null || { echo "ERREUR : firebase-tools non installé. Lance : npm install -g firebase-tools"; exit 1; }

echo "→ Vérification auth..."
firebase projects:list > /dev/null 2>&1 || { echo "ERREUR : pas authentifié. Lance : firebase login"; exit 1; }

echo "→ Backup des rules actuelles vers firestore.rules.backup.$(date +%Y%m%d-%H%M%S)"
cp firestore.rules "firestore.rules.backup.$(date +%Y%m%d-%H%M%S)"

echo "→ Bascule firestore.rules.v2 → firestore.rules"
cp firestore.rules.v2 firestore.rules

echo "→ Déploiement des rules Firestore..."
firebase deploy --only firestore:rules

echo ""
echo "✅ Déploiement OK"
echo ""
echo "Prochaine étape : tester en prod que les pages fonctionnent toujours."
echo "Si régression : restaurer le backup avec cp firestore.rules.backup.* firestore.rules && firebase deploy --only firestore:rules"
