# SSB browser demo

![Screenshot of ssb browser demo][screenshot]

A secure scuttlebutt client interface in the browser. Built using
[ssb-browser-core]. This was originally made as a demo for my bornhack
[talk][bornhack-talk].

The client was made for two purposes: test ssb in a browser and for
evaluating different partial replication strategies.

Partial replication is done by only getting the last few `post`
messages for users as a way of onboarding users quickly. The client
can download and index around 5.000 messages in 30 seconds on my
really slow laptop (roughly same speed on a mid-range phone). For
this, a blob (generate-onboarding-json.js) must be provided that
serves as a trusted onboard mechanism.

This will provide an initial load of data and people. You then sync
the feeds of these people, but selective sync can be done by following
people directly.

Peer invites is another way to onboard people. The client allows one
to generate and use peer invites. The invites can include an list of
people to follow beside the user that created the invite. In doing so,
these invites serves the same function as the onboarding blob.

This project tries to make partial replication better is by using the
[ssb-contact-msg] library where contact messages are linked together.

As a way to let people explore the messages from users outside ones
follow graph, the [ssb-partial-replication] plugin is used to get
threads from the server. This has privacy implications so this need to
be configurable, see TODO.

The UI is written in vue.js and can display posts and self assigned
profile about messages. Leaving out likes was done on purpose as an
experiment. I don't plan on adding them.

Things that work:
 - viewing posts and threads
 - posting and replying to messages including posting blobs
 - automatic exif stripping (such as GPS coordinates) on images for better privacy
 - automatic image resizing of large images
 - viewing profiles and setting up your own profile
 - private messages including private blobs
 - creating and using peer invites
 - offline support and PWA (mobile)
 - off-chain chat using ssb-tunnel for e2e encrypted messages
 - ooo messages for messages from people outside your current follow graph
 - deleting messages included a whole profile
 - channels
 - notifications
 - backup / restore feed using mnemonics
 - easily run alternative [networks][pub-setup]

Tested with Chrome and Firefox. Chrome is faster because it uses fs
instead of indexeddb. Also tested on android using Chrome and iOS
using safari.

An online version is available for testing [here][test-server]

# Running locally

For testing this in Chrome locally, one must run it with:
--allow-file-access-from-files

# Server

I made a [blog post][pub-setup] that should tell you exactly how to get a pub running.

# Peer invites

Peer invites are included in the app, but can be created on another client using:

```
sbot peerInvites.create --private 'this is only for receiver' --reveal 'the public' --allowWithoutPubs --pubs wss:between-two-worlds.dk:8989~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8=.ed25519
```

# Onboarding file

Generate a file of all feeds following with seq nos. The perspective
(user) can be changed in top.

```
node generate-onboarding-json.js > onboard.json
```

Add it as a blob to the network:

```
cat onboard.json | ../ssb-minimal-pub-server/bin.js blobs.add
```

=> something like

&iRW9+26q1StUywvh0dp6TRU3uF1Ay0UuTAsuM8IEhNE=.sha256

## Onboarding diff

Test of roughly a 20 days diff of two onboarding files:

```
node generate-onboarding-diff.js onboard.json onboard-2.json > onboard-diff.json
```

= 28kb (12kb gzip), the initial onboard is roughly 267kb (131kb
gzip). If we removed the unused key on latestMsg, we could bring the
diff size down quite a bit. Initial without lastMsg key is 244kb.

# Building

`npm run build` for developing and `npm run release` for a much smaller bundle.

# TODO

- peer-invites:
  - somehow handle that we have a new friend (SSB.db.friends)
- port over ssb-friend-pub
- disable or trust pubs as a way to control when to fetch threads

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

## indexes

Backlinks & query uses flumeview-level that stores it's db in indexdb
in the browser. These indexes are slower in the browser.

## mcss generate css

mcss plugs/app/page/books.mcss -o books.css

[screenshot]: assets/screenshot.jpg
[ssb-browser-core]: https://github.com/arj03/ssb-browser-core
[bornhack-talk]: https://people.iola.dk/arj/2019/08/11/bornhack-talk/
[ssb-partial-replication]: https://github.com/arj03/ssb-partial-replication
[ssb-peer-invites]: https://github.com/ssbc/ssb-peer-invites
[test-server]: https://between-two-worlds.dk/browser.html
[ssb-contact-msg]: https://github.com/ssbc/ssb-contact-msg
[pub-setup]: https://people.iola.dk/arj/2020/03/04/how-to-setup-a-pub-for-ssb-browser/
