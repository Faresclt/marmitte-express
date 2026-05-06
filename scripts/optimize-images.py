#!/usr/bin/env python3
"""
optimize-images.py — Convertit les PNG du dossier images/ en WebP en 3 tailles.

Sortie : images/optimized/<base>-{thumb,medium,full}.webp
  - thumb  = 200px de large  (utilisé dans les listes du menu)
  - medium = 600px de large  (utilisé dans le détail plat)
  - full   = 1200px de large (fallback haute résolution)

Prérequis : pip install Pillow

Usage :
  python3 scripts/optimize-images.py            # toutes les images
  python3 scripts/optimize-images.py --quality 85
  python3 scripts/optimize-images.py --force    # reconvertit même si à jour
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERREUR : Pillow n'est pas installé.\n  → pip install Pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "images"
OUT_DIR = SRC_DIR / "optimized"

VARIANTS = {
    "thumb":  200,
    "medium": 600,
    "full":   1200,
}


def human(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def convert_one(src: Path, quality: int, force: bool) -> tuple[int, int]:
    """Convertit un PNG en 3 variants WebP. Renvoie (taille_src, taille_thumb)."""
    src_size = src.stat().st_size
    base = src.stem

    img = Image.open(src)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    thumb_size = 0
    for variant, width in VARIANTS.items():
        out = OUT_DIR / f"{base}-{variant}.webp"
        if not force and out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            if variant == "thumb":
                thumb_size = out.stat().st_size
            continue

        if img.width <= width:
            resized = img.copy()
        else:
            ratio = width / img.width
            new_h = int(img.height * ratio)
            resized = img.resize((width, new_h), Image.LANCZOS)

        save_kwargs = {"quality": quality, "method": 6}
        # WebP gère mal le mode "RGBA" + lossy : on force le RGB si pas de transparence
        if resized.mode == "RGBA":
            extrema = resized.getchannel("A").getextrema()
            if extrema == (255, 255):  # alpha plein partout
                resized = resized.convert("RGB")

        resized.save(out, "WEBP", **save_kwargs)
        if variant == "thumb":
            thumb_size = out.stat().st_size

    return src_size, thumb_size


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--quality", type=int, default=82, help="qualité WebP (défaut 82)")
    parser.add_argument("--force", action="store_true", help="reconvertir même si à jour")
    parser.add_argument("--limit", type=int, default=0, help="limiter à N images (debug)")
    args = parser.parse_args()

    if not SRC_DIR.exists():
        print(f"ERREUR : {SRC_DIR} introuvable.", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    pngs = sorted(SRC_DIR.glob("*.png"))
    if args.limit:
        pngs = pngs[: args.limit]

    if not pngs:
        print(f"Aucun PNG dans {SRC_DIR}")
        return 0

    print(f"Conversion de {len(pngs)} image(s) → {OUT_DIR}")
    print(f"Qualité WebP : {args.quality}")
    print(f"Variants     : thumb=200px, medium=600px, full=1200px\n")

    total_src = 0
    total_thumb = 0
    for i, src in enumerate(pngs, 1):
        src_size, thumb_size = convert_one(src, args.quality, args.force)
        total_src += src_size
        total_thumb += thumb_size
        ratio = (1 - thumb_size / src_size) * 100 if src_size else 0
        print(f"  [{i:3d}/{len(pngs)}] {src.name:<45} {human(src_size):>10}  →  {human(thumb_size):>9}  (-{ratio:.0f}%)")

    saved = total_src - total_thumb
    overall = (1 - total_thumb / total_src) * 100 if total_src else 0
    print(f"\n✓ {len(pngs)} image(s) converties")
    print(f"  Total source (PNG)   : {human(total_src)}")
    print(f"  Total thumb (WebP)   : {human(total_thumb)}")
    print(f"  Économie sur thumb   : {human(saved)}  (-{overall:.0f}%)")
    print(f"\nUtilisation HTML :")
    print('  <picture>')
    print('    <source type="image/webp" srcset="images/optimized/foo-thumb.webp">')
    print('    <img src="images/foo.png" alt="…" loading="lazy" decoding="async">')
    print('  </picture>')
    return 0


if __name__ == "__main__":
    sys.exit(main())
