const pull = require('pull-stream')

const os = require('os')
const path = require('path')

// in browser this will be local storage
const dir = path.join(os.homedir(), ".ssb-lite")

const s = require('sodium-browserify')
s.events.on('sodium-browserify:wasm loaded', function() {

  console.log("wasm loaded")

  var server = require('./server')
  var net = server.init(dir)

  var DB = require('./db')
  var db = DB.init(dir, net.id)

  console.log("my id: ", net.id)

  var helpers = require("./test-helpers")
  helpers.init(dir, db, net)

  return


  // playground

  const msgId = "%IwG4GtadWmHUhsn+YJZBXs9D7/wnPtlTuVOTVrPl+0o=.sha256"
  const feedId = "@6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"
  const blobId = "&Il2SFDKScJcqt3CTl+ZaeIJLXGwmPbQHUTi9lVaUH5c=.sha256"

  //var remoteAddress = "onion:4fqstkswahy3n7mupr2gvvp2qcsp6juwzn3mnqvhkaixxepvxrrtfbid.onion:8008~shs:lbocEWqF2Fg6WMYLgmfYvqJlMfL7hiqVAV6ANjHWNw8="
  var remoteAddress = "net:ssb.celehner.com:8008~shs:5XaVcAJ5DklwuuIkjGz4lwm2rOnMHHovhNg7BFFnyJ8="
  remoteAddress = "net:eight45.net:8008~shs:eM4e8pmRiZpeCBitqp6vq3lT8EwC5UjjKuajHbpWnNI="
  remoteAddress = "ws:localhost:8989~shs:6CAxOI3f+LUOVrbAl0IemqiS7ATpQvr9Mdw9LC4+Uv0=.ed25519"

  net.connect(remoteAddress, (err, rpc) => {
    if (err) throw(err)

    console.log("connected to: ", rpc.id)

    //console.log(rpc)

    /*
      pull(
      rpc.blobs.get({key: blobId}),
      net.blobs.add(blobId) // save locally
      )
    */

    /*
    // you call this on yourself and it will try to get the message from all connected peers
    net.ooo.get(msgId, (err, msg) => {
    console.log("err", err)
    console.log("msg", msg)
    })
    */

    /*
    db.get("%AJX/ZPTgqchv8w6Kph0Zc9cYjVfwVn+dEVfDs+ATmTo=.sha256", (err, msg) => {
      console.log("msg:", msg)
    })
    */

    /*
    pull(
      db.query.read({
	reverse: true,
	limit: 2,
	// live: true,
	// old: false // good with live: true
	query: [
	  {
	    $filter: {
              value: {
		content: { type: 'git-update' }
              }
	    }
	  }
	]
      }),
      pull.drain((msg) => {
	console.log(msg)
      })
    )
    */

    /*
    pull(
      db.backlinks.read({
	query: [{$filter: {dest: "%sgI5ru51jP2gNXxDIaPgoVL8Uo99gVTd1FXEBM6uzck=.sha256"}}],
	index: 'DTA'
      }),
      pull.drain(console.log)
    )
    */

    /*
    console.time("history stream validate")

    var validate = require('ssb-validate')
    var hmac_key = null
    var state = validate.initial()

    function getRandomInt(max) {
      return Math.floor(Math.random() * Math.floor(max));
    }

    pull(
      rpc.createHistoryStream({id: feedId, seq: 0, keys: false}),
      pull.drain((msg) => {
	// validate all
	//state = validate.append(state, hmac_key, msg)

	// validate end only
	state = validate.queue(state, msg)
	if(state.error) console.error(state.error)

	if (msg.sequence % 50 == getRandomInt(50)) {
	  //console.log("doing random validation check")
	  for(var feed_id in state.feeds)
	    state = validate.validate(state, hmac_key, feed_id)
	  state = validate.queue(state, msg)
	}

	//console.log("adding msg")
	//db.add(msg, (err, resp) => {
	//  console.log("err ", err)
	//  console.log("added ", msg)
	//})
      }, (err) => {
	// validate end only
	for(var feed_id in state.feeds)
	  state = validate.validate(state, hmac_key, feed_id)

	console.timeEnd("history stream validate")
	console.log("done", err)
      })
    )
    */
  })
})
