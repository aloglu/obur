#!/usr/bin/env bash
# Makes the served app icons from the owner's artwork in assets/brand/ (1024 px PNGs; the SVGs there have outline
# flaws, so the PNGs are the source). Needs ImageMagick 7. Run from the repository root: ./scripts/brand-icons.sh
set -euo pipefail

src=assets/brand
bg="$src/obur_brown_background_cream_bowl.png"
out=static

resize() { magick "$1" -filter Lanczos -resize "$2x$2" -strip -define png:compression-level=9 "$3"; }

# Home screen: iOS and the manifest's "any" icons use the full artwork on its own background.
resize "$bg" 180 "$out/icon-180.png"
resize "$bg" 192 "$out/icon-192.png"
resize "$bg" 512 "$out/icon-512.png"
# Android's maskable icon may be cropped to the central 80 % circle: the O shrinks to fit, on the same background.
magick "$bg" -filter Lanczos -resize 88% -background '#211D19' -gravity center -extent 1024x1024 \
	-resize 512x512 -strip -define png:compression-level=9 "$out/icon-maskable-512.png"

# Logo and browser tab icon without a background: the brown bowl on light, the cream bowl on dark, with the
# artwork's empty margin trimmed so the O fills its square.
mkdir -p "$out/brand"
tmp=$(mktemp --suffix=.png)
trap 'rm -f "$tmp"' EXIT
for variant in brown cream; do
	magick "$src/obur_transparent_${variant}_bowl.png" -trim +repage -background none -gravity center \
		-extent 812x812 "$tmp"
	resize "$tmp" 128 "$out/brand/logo-$variant.png"
	resize "$tmp" 48 "$out/brand/favicon-$variant.png"
done
