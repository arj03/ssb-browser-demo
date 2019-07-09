# browserify 2mb

Removing blobs means that we go down to 1.6mb

Apply sodium-browserify.patch for this to work

browserify --full-paths test.js > bundle.js

## uglifyify

browserify --full-paths -g uglifyify test.js > bundle.js

=> 1.2mb

# Other

## mcss generate css

mcss plugs/app/page/books.mcss -o books.css

