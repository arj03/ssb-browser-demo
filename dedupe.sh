#!/usr/bin/env bash
# Dedupe pull-stream.
sed -i 's/2.26.0/3.6.14/' node_modules/pull-async-filter/package.json
rm -rf node_modules/pull-async-filter/node_modules/pull-stream
sed -i 's/3.5.0/3.6.14/' node_modules/pull-goodbye/package.json
rm -rf node_modules/pull-goodbye/node_modules/pull-stream

# Patch out Highlight.js.
sed -i -e '/highlight: function/,+8 d' -e '/highlight/d' node_modules/ssb-markdown/lib/block.js
sed -i '/highlight.js/d' node_modules/ssb-markdown/package.json
rm -rf node_modules/highlight.js

# Dedupe tweetnacl.
sed -i 's/0.14.1/1.0.3/' node_modules/sodium-browserify/package.json
rm -rf node_modules/sodium-browserify/node_modules/tweetnacl
sed -i 's/0.x.x/1.0.3/' node_modules/tweetnacl-auth/package.json
rm -rf node_modules/tweetnacl-auth/node_modules/tweetnacl
sed -i 's/0.x.x/1.0.3/' node_modules/ed2curve/package.json
rm -rf node_modules/ed2curve/node_modules/tweetnacl
