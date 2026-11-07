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

# The other app icons people can choose on Appearance (docs/ui.md, "App icon"): the same artwork with only the
# background and the O in a theme's colours, made from the SVG (the bowl and food keep the artwork's colours).
# Pazar, the default, is the icon above. Each set lives in static/app-icons/<id>/; the list matches
# src/lib/shared/app-icons.ts.
svg="$src/obur_brown_background_cream_bowl.svg"
variants=(
	'pazar-light #f6f3ee #c2410c'
	'sade #111113 #3b74ef'
	'zerde #1c130a #f5b301'
	'patlican #1a0e19 #e6a4d4'
	'zeytin #15160a #cbd66a'
	'disko #120829 #ff2e9a'
	'kaset #6fe3d6 #5b1fbf'
	'sinyal #c6ff00 #0e0f0a'
)
big=$(mktemp --suffix=.png)
svgtmp=$(mktemp --suffix=.svg)
trap 'rm -f "$tmp" "$big" "$svgtmp"' EXIT
for v in "${variants[@]}"; do
	read -r id back letter <<<"$v"
	mkdir -p "$out/app-icons/$id"
	sed -e "s/fill=\"#211d19\"/fill=\"$back\"/" -e "s/fill=\"#bf4710\"/fill=\"$letter\"/" "$svg" >"$svgtmp"
	magick -background none -density 384 "$svgtmp" -resize 1024x1024 "$big"
	resize "$big" 180 "$out/app-icons/$id/icon-180.png"
	resize "$big" 192 "$out/app-icons/$id/icon-192.png"
	resize "$big" 512 "$out/app-icons/$id/icon-512.png"
	magick "$big" -filter Lanczos -resize 88% -background "$back" -gravity center -extent 1024x1024 \
		-resize 512x512 -strip -define png:compression-level=9 "$out/app-icons/$id/icon-maskable-512.png"
done
