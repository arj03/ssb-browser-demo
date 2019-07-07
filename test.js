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
  keys
})
.use(require('./hist'))
.use(require('./simple-ooo'))
//    .use(require('ssb-onion'))
()

var msgId = "%IwG4GtadWmHUhsn+YJZBXs9D7/wnPtlTuVOTVrPl+0o=.sha256"
var feedId = "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
//var remoteAddress = "onion:4fqstkswahy3n7mupr2gvvp2qcsp6juwzn3mnqvhkaixxepvxrrtfbid.onion:8008~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8="
var remoteAddress = "net:ssb.celehner.com:8008~shs:5XaVcAJ5DklwuuIkjGz4lwm2rOnMHHovhNg7BFFnyJ8="

app.connect(remoteAddress, (err, rpc) => {

  //console.log(rpc)
  
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
