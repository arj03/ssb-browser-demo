# SSB browser demo

![Screenshot of ssb browser demo][screenshot]

A secure scuttlebutt client interface running 100% in the browser. Built using
[ssb-browser-core]. This was originally made as a demo for my bornhack
[talk][bornhack-talk].

The client was made for two purposes: test ssb in a browser and for
evaluating different partial replication strategies.

Feeds are stored in full for feeds you follow directly. For feeds
followed by a feed you follow (hops 2), you only store a partial
replica of their messages.

If you are a new user, the best way to get started is to get the id of
a person already on the network, go to their profile page and start
following that person. After this you will start seeing their messages
and the messages of their extended graph. In order for them to see
your messages, they will need to follow you back. You can get your id
on the profile page.

As a way to let people explore the messages from users outside ones
follow graph, the [ssb-partial-replication] plugin is used to get
threads from the server. 

The UI is written in vue.js and can display posts and self assigned
profile about messages.

Things that work:
 - partial replication
 - direct connections to other peers using [rooms]
 - viewing posts and threads, including forks, backlinks and reactions
 - posting, adding reactions, replying to messages including posting blobs
 - automatic exif stripping (such as GPS coordinates) on images for better privacy
 - automatic image resizing of large images
 - viewing profiles and setting up your own profile
 - private messages including private blobs
 - offline support and PWA (mobile)
 - ooo messages for messages from people outside your current follow graph
 - deleting messages included a whole profile
 - blocking
 - channels
 - notifications
 - themes
 - translations
 - backup / restore feed using mnemonics
 - easily run alternative [networks][pub-setup]

Tested with Chrome and Firefox. Chrome is faster because it uses fs
instead of indexeddb. Also tested on android using Chrome and iOS
using safari.

An online version is available for testing [here][test-server]

# Running locally

For testing this locally, one needs to run a local http server like
`npm i -g http-server`.

# Server

I made a [blog post][pub-setup] on how to run a server pub to relay messages to other nodes through.

# Building

`npm run build` for developing and `npm run release` for a much smaller bundle.  You can also run `npm run inline` to genereate a single monolithic index.html file with all resources included.

# Enabling WebSockets in ssb-room

To run an ssb-room which this can connect to, you will need to enable WebSockets support.  This requires three things:

1. In ssb-room's config.js, add a line to `connections` to configure the WebSockets port (external, key, and cert need to be customized for your installation):
```
  connections: {
    incoming: {
      net: [{ port: 8888, host: "0.0.0.0", scope: "public", transform: "shs" }],
      ws: [{ port: 9999, host: "::", scope: "public", transform: "shs", external: ["example.com"], http: true }],
      // Or, to use secure WebSockets:
      // ws: [{ port: 9999, host: "::", scope: "public", transform: "shs", external: ["example.com"], key: "/etc/letsencrypt/live/example.com/privkey.pem", cert: "/etc/letsencrypt/live/example.com/cert.pem" }],
    },
    outgoing: {
      net: [{transform: 'shs'}],
    },
  },
```
2. Run either `npm install -g ssb-ws` to install the WebSockets connector globally, or cd into the ssb-room directory and `npm install ssb-ws`
3. In index.js, add the following line to the SecretStack section just below `ssb-logging`:
```
  .use(require('ssb-ws'))
```

After that, your ssb-room will be compatible with ssb-browser-demo.

# Other

## Force WASM locally (outside browser)

rm -rf node_modules/sodium-chloride/

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

List all files in browser

``` javascript
function listDir(fs, path)
{
  fs.root.getDirectory(path, {}, function(dirEntry){
    var dirReader = dirEntry.createReader();
    dirReader.readEntries(function(entries) {
    for(var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isDirectory) {
            console.log('Directory: ' + entry.fullPath);
            listDir(fs, entry.fullPath)
        }
        else if (entry.isFile)
            console.log('File: ' + entry.fullPath);
        }
    })
  })
}

window.webkitRequestFileSystem(window.PERSISTENT, 0, function (fs) {
  listDir(fs, '/.ssb-lite/')
})
```

[screenshot]: assets/screenshot.jpg
[ssb-browser-core]: https://github.com/arj03/ssb-browser-core
[bornhack-talk]: https://people.iola.dk/arj/2019/08/11/bornhack-talk/
[ssb-partial-replication]: https://github.com/arj03/ssb-partial-replication
[ssb-peer-invites]: https://github.com/ssbc/ssb-peer-invites
[test-server]: https://between-two-worlds.dk/browser.html
[ssb-contact-msg]: https://github.com/ssbc/ssb-contact-msg
[pub-setup]: https://people.iola.dk/arj/2020/03/04/how-to-setup-a-pub-for-ssb-browser/
[rooms]: https://github.com/staltz/ssb-room
