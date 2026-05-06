#!/usr/bin/env bash
# ============================================================
# optimize-images.sh
# Convertit les PNG du dossier images/ en WebP en 3 tailles :
#   - thumb  (200px de large) → utilisé dans le menu/liste
#   - medium (600px de large) → utilisé dans les détails plat
#   - full   (1200px de large) → fallback haute résolution
#
# Réduit typiquement 2 MB → 50-150 KB (WebP qualité 82).
#
# Prérequis : ImageMagick OU cwebp (libwebp)
#   macOS:  brew install imagemagick webp
#   Ubuntu: sudo apt install imagemagick webp
#
# Usage :
#   ./scripts/optimize-images.sh
#   ./scripts/optimize-images.sh --keep-original  # ne supprime pas le PNG
# ============================================================

set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/images"
OUT_DIR="$SRC_DIR/optimized"
KEEP_ORIGINAL=false

for arg in "$@"; do
  case "$arg" in
    --keep-original) KEEP_ORIGINAL=true ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# ── Détection de l'outil disponible ────────────────────────
if command -v cwebp >/dev/null 2>&1; then
  CONVERTER="cwebp"
elif command -v magick >/dev/null 2>&1; then
  CONVERTER="magick"
elif command -v convert >/dev/null 2>&1; then
  CONVERTER="convert"
else
  echo "ERREUR : aucun convertisseur trouvé."
  echo "  → brew install imagemagick webp"
  echo "  → sudo apt install imagemagick webp"
  exit 1
fi

echo "Convertisseur : $CONVERTER"
echo "Source        : $SRC_DIR"
echo "Sortie        : $OUT_DIR"
mkdir -p "$OUT_DIR"

# ── Compteurs ──────────────────────────────────────────────
total=0
done=0
saved_bytes=0

# ── Conversion ─────────────────────────────────────────────
for src in "$SRC_DIR"/*.png; do
  [ -f "$src" ] || continue
  total=$((total + 1))

  base="$(basename "$src" .png)"
  src_size=$(stat -c '%s' "$src" 2>/dev/null || stat -f '%z' "$src")

  for variant in "thumb:200" "medium:600" "full:1200"; do
    name="${variant%:*}"
    width="${variant#*:}"
    out="$OUT_DIR/${base}-${name}.webp"

    if [ -f "$out" ] && [ "$out" -nt "$src" ]; then
      continue  # Déjà à jour
    fi

    case "$CONVERTER" in
      cwebp)
        cwebp -quiet -q 82 -resize "$width" 0 "$src" -o "$out"
        ;;
      magick|convert)
        $CONVERTER "$src" -resize "${width}x" -quality 82 "$out"
        ;;
    esac
  done

  done=$((done + 1))

  thumb_size=$(stat -c '%s' "$OUT_DIR/${base}-thumb.webp" 2>/dev/null || stat -f '%z' "$OUT_DIR/${base}-thumb.webp")
  saved=$((src_size - thumb_size))
  saved_bytes=$((saved_bytes + saved))

  printf "  [%2d/%d] %-40s  %s → %s\n" \
    "$done" "$total" \
    "${base:0:40}" \
    "$(numfmt --to=iec-i --suffix=B "$src_size" 2>/dev/null || echo "${src_size}B")" \
    "$(numfmt --to=iec-i --suffix=B "$thumb_size" 2>/dev/null || echo "${thumb_size}B")"
done

echo ""
echo "✓ Terminé : $done images converties"
echo "  Économie estimée (vs thumb) : $(numfmt --to=iec-i --suffix=B "$saved_bytes" 2>/dev/null || echo "${saved_bytes}B")"

if [ "$KEEP_ORIGINAL" = false ]; then
  echo ""
  echo "Pour supprimer les PNG originaux :"
  echo "  rm $SRC_DIR/*.png"
  echo "(non fait automatiquement — relance avec --keep-original supprimé pour confirmer)"
fi

echo ""
echo "Utilisation HTML recommandée :"
echo '  <picture>'
echo '    <source type="image/webp" srcset="images/optimized/foo-thumb.webp 200w, images/optimized/foo-medium.webp 600w" sizes="(max-width: 600px) 64px, 600px">'
echo '    <img src="images/foo.png" alt="Foo" loading="lazy" decoding="async">'
echo '  </picture>'
