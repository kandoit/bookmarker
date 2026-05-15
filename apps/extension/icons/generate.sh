#!/bin/bash
# Run this script once to generate extension icons from the SVG
# Requires: rsvg-convert (sudo apt-get install librsvg2-bin) or Inkscape

SVG=$(cat <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#7c3aed"/>
  <text x="64" y="95" font-size="80" text-anchor="middle">🔖</text>
</svg>
EOF
)

echo "$SVG" > icon.svg

for size in 16 48 128; do
  if command -v rsvg-convert &>/dev/null; then
    rsvg-convert -w $size -h $size icon.svg > icon${size}.png
  elif command -v inkscape &>/dev/null; then
    inkscape --export-filename=icon${size}.png -w $size -h $size icon.svg
  else
    echo "Install rsvg-convert or inkscape to generate icons"
    break
  fi
done

rm -f icon.svg
echo "Icons generated"
