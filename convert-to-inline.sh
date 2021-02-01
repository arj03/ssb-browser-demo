#!/bin/bash
node node_modules/inline-source-cli/dist/index.js --compress false --attribute '' --root dist/ dist/index.html dist/index-inlined.html
for SVG in assets/*.svg; do
  echo "Inlining ${SVG}"
  sed -i -f - dist/index-inlined.html << EOF
s~../${SVG}~data:image/svg+xml;base64,$(base64 -w 0 "${SVG}")~
EOF
done
for JPEG in assets/*.jpg; do
  echo "Inlining ${JPEG}"
  sed -i -f - dist/index-inlined.html << EOF
s~../${JPEG}~data:image/jpeg;base64,$(base64 -w 0 "${JPEG}")~
EOF
done
for FONT in css/*.ttf; do
  FONT_LOCAL="$(basename -- "${FONT}")"
  echo "Inlining ${FONT_LOCAL}"
  sed -i -f - dist/index-inlined.html << EOF
s~./${FONT_LOCAL}~data:font-ttf;base64,$(base64 -w 0 "${FONT}")~
EOF
done
pushd dist
find . \! -name 'index-inlined.html' \! -name 'favicon.ico' -delete
mv index-inlined.html index.html
popd
