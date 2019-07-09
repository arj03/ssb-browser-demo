var pull = require('pull-stream')

var os = require('os')
var path = require('path')

var dir = path.join(os.homedir(), ".ssb-lite")

var server = require('./server')
var app = server.init(dir)

var DB = require('./db')
var db = DB.init(dir)

var msgId = "%IwG4GtadWmHUhsn+YJZBXs9D7/wnPtlTuVOTVrPl+0o=.sha256"
var feedId = "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
var blobId = "&Il2SFDKScJcqt3CTl+ZaeIJLXGwmPbQHUTi9lVaUH5c=.sha256"

//var remoteAddress = "onion:4fqstkswahy3n7mupr2gvvp2qcsp6juwzn3mnqvhkaixxepvxrrtfbid.onion:8008~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8="
var remoteAddress = "net:ssb.celehner.com:8008~shs:5XaVcAJ5DklwuuIkjGz4lwm2rOnMHHovhNg7BFFnyJ8="
remoteAddress = "net:eight45.net:8008~shs:eM4e8pmRiZpeCBitqp6vq3lT8EwC5UjjKuajHbpWnNI="
remoteAddress = "ws:localhost:8989~shs:6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"

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
  // you call this on yourself and it will try to get the message from all connected peers
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
