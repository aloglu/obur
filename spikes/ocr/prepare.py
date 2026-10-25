"""Phase 0 probe: convert label photos to orientation-corrected JPEGs with no metadata.

Usage: prepare.py <in-dir> <out-dir>
Writes <out-dir>/full/LNN.jpg (original resolution) and <out-dir>/preview/LNN.jpg (1600 px long side),
plus <out-dir>/mapping.tsv from the original file name to the label ID.
"""

import sys
from pathlib import Path

import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    (out / "full").mkdir(parents=True, exist_ok=True)
    (out / "preview").mkdir(parents=True, exist_ok=True)
    rows = ["label\toriginal\twidth\theight"]
    for n, path in enumerate(sorted(p for p in src.iterdir() if p.suffix.lower() in (".heic", ".jpg", ".jpeg", ".png")), 1):
        label = f"L{n:02d}"
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            # A fresh image carries no EXIF, GPS or maker notes.
            clean = Image.new("RGB", im.size)
            clean.paste(im)
        clean.save(out / "full" / f"{label}.jpg", quality=92)
        preview = clean.copy()
        preview.thumbnail((1600, 1600))
        preview.save(out / "preview" / f"{label}.jpg", quality=85)
        rows.append(f"{label}\t{path.name}\t{clean.width}\t{clean.height}")
    (out / "mapping.tsv").write_text("\n".join(rows) + "\n")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
