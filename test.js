var SecretStack = require('secret-stack')
var caps = require('ssb-caps')
var ssbKeys = require('ssb-keys')

var pull = require('pull-stream')

var os = require('os')
var path = require('path')

var dir = path.join(os.homedir(), ".ssb-lite")
var keys = ssbKeys.loadOrCreateSync(path.join(dir, 'secret'))

var DB = require("./db")
var db = DB.init(dir)

var app = SecretStack({
  caps: { shs: Buffer.from(caps.shs, 'base64') },
  keys,
  connections: {
    outgoing: {
      net: [{ transform: 'shs' }],
      onion: [{ transform: 'shs' }]
    }
  },
  path: dir
})
.use(require('./hist'))
.use(require('./simple-ooo'))
.use(require('ssb-onion'))
.use(require('ssb-blobs'))
()

var msgId = "%IwG4GtadWmHUhsn+YJZBXs9D7/wnPtlTuVOTVrPl+0o=.sha256"
var feedId = "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
var blobId = "&Il2SFDKScJcqt3CTl+ZaeIJLXGwmPbQHUTi9lVaUH5c=.sha256"

//var remoteAddress = "onion:4fqstkswahy3n7mupr2gvvp2qcsp6juwzn3mnqvhkaixxepvxrrtfbid.onion:8008~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8="
var remoteAddress = "net:ssb.celehner.com:8008~shs:5XaVcAJ5DklwuuIkjGz4lwm2rOnMHHovhNg7BFFnyJ8="
remoteAddress = "net:eight45.net:8008~shs:eM4e8pmRiZpeCBitqp6vq3lT8EwC5UjjKuajHbpWnNI="

app.connect(remoteAddress, (err, rpc) => {
  if (err) throw(err)

  //console.log(rpc)

  /*
  pull(
    rpc.blobs.get({key: blobId}),
    app.blobs.add(blobId) // save locally
  )
  */

  /*
  app.ooo.get(msgId, (err, msg) => {
    console.log("err", err)
    console.log("msg", msg)
  })
  */

  /*
  pull(
    rpc.createHistoryStream({id: feedId, seq: 4000, keys: false}),
    pull.drain((msg) => {
      console.log(msg)
    }, (err) => {
      console.log("done", err)
    })
  )
  */
})
