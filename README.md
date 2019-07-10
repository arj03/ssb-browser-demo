Tested in Chrome which provides a file api.

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

## remove db

```
const createFile = require('random-access-chrome-file')
const file = createFile(path.join(dir, 'log.offset'))
file.open((err, done) => {
  file.destroy()
})
```

## oasis

%owvZa0OwPBH2olaKUiex1wqyBO/+AeBlxEHcH7jORtA=.sha256

## mcss generate css

mcss plugs/app/page/books.mcss -o books.css

