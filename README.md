Tested in Chrome which provides a file api.

Chrome needs to be run with: --allow-file-access-from-files to work!

Also be sure to enable all 3 WASM options in
chrome://flags/. Otherwise crypto will be super slow (like validate).

Apply sodium-browserify.patch, flumelog-hax.patch,
flumeview-level-mkdirp.patch & ssb-validate-ooo.patch for this to
work.

See:
 - https://github.com/random-access-storage/random-access-web/issues/4
 - https://github.com/dominictarr/sodium-browserify/pull/6
 - https://github.com/ssbc/ssb-validate/pull/16

# Onboarding file

Generate a file of all feeds following with seq nos. The perspective
(user) can be changed in top.

```
node generate-onboarding-json.js > onboard.json
```

# Force WASM locally (outside browser)

rm -rf node_modules/sodium-chloride/

# browserify 2mb

Removing blobs means that we go down to 1.6mb. ssb-backlinks brings
this back to 2mb because of level.

browserify --full-paths core.js > bundle-core.js
browserify --full-paths browser-test.js > bundle-test.js

ssb-markdown increases the size quite substantially

## uglifyify

browserify --full-paths -g uglifyify -p common-shakeify core.js > bundle-core.js
browserify --full-paths -g uglifyify -p common-shakeify browser-test.js > bundle-test.js

=> 1.2mb

# Other

## check contents of db

```
var pull = require("pull-stream")

pull(
  store.stream(),
  pull.drain((msg) => {
    console.log(msg)
  })
)
```

## indexes

Backlinks & query uses flumeview-level that stores it's db in indexdb
in the browser. These indexes are much slower in the browser.

## oasis

%owvZa0OwPBH2olaKUiex1wqyBO/+AeBlxEHcH7jORtA=.sha256

## mcss generate css

mcss plugs/app/page/books.mcss -o books.css

