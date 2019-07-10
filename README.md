Tested in Chrome that has file api.

Chrome needs to be run with: --allow-file-access-from-files to work!

Apply sodium-browserify.patch and flumelog-hax.patch for this to work.

See:
 - https://github.com/random-access-storage/random-access-web/issues/4
 - https://github.com/dominictarr/sodium-browserify/pull/6

# browserify 2mb

Removing blobs means that we go down to 1.6mb

browserify --full-paths test.js > bundle.js

## uglifyify

browserify --full-paths -g uglifyify test.js > bundle.js

=> 1.2mb

# Other

## remove db

window.localStorage.removeItem('/.ssb-lite/keys.ht')
window.localStorage.removeItem('/.ssb-lite/log.offset')

## oasis

%owvZa0OwPBH2olaKUiex1wqyBO/+AeBlxEHcH7jORtA=.sha256

## mcss generate css

mcss plugs/app/page/books.mcss -o books.css

