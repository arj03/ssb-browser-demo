#!/usr/bin/env bash
node node_modules/inline-source-cli/dist/index.js --compress false --attribute '' --root dist/ dist/index.html dist/index-inlined.html
echo "Starting size is $(du dist/index-inlined.html | cut -f 1)k"
for SVG in assets/*.svg; do
  echo "Inlining ${SVG}"
  sed -i -f - dist/index-inlined.html << EOF
s~../${SVG}~data:image/svg+xml;base64,$(base64 -w 0 "${SVG}")~
EOF
  echo "Size is now $(du dist/index-inlined.html | cut -f 1)k"
done
for JPEG in assets/*.jpg; do
  echo "Inlining ${JPEG}"
  sed -i -f - dist/index-inlined.html << EOF
s~../${JPEG}~data:image/jpeg;base64,$(base64 -w 0 "${JPEG}")~
EOF
  echo "Size is now $(du dist/index-inlined.html | cut -f 1)k"
done
for FONT in css/*.ttf; do
  FONT_LOCAL="$(basename -- "${FONT}")"
  echo "Inlining ${FONT_LOCAL}"
  if [[ "${FONT_LOCAL}" == "NotoColorEmoji.ttf" ]]; then
    FONT="css/NotoColorEmoji-Small.ttf"
  fi
  sed -i -f - dist/index-inlined.html << EOF
s~./${FONT_LOCAL}~data:font-ttf;base64,$(base64 -w 0 "${FONT}")~
EOF
  echo "Size is now $(du dist/index-inlined.html | cut -f 1)k"
done
echo "Final size is $(du dist/index-inlined.html | cut -f 1)k"
pushd dist
find . \! -name 'index-inlined.html' \! -name 'favicon.ico' -delete
mv index-inlined.html index.html
popd
