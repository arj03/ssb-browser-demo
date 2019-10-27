// this needs refactoring, but is close to ssb-blobs

const path = require('path')
const raf = require('polyraf')
const pull = require('pull-stream')
const defer = require('pull-defer')
const BoxStream = require('pull-box-stream')
const chromeFS = require('random-access-chrome-file')
const sanitize = require('sanitize-filename')

exports.manifest = {
  has: 'async',
  get: 'source',
  createWants: 'source',
}

exports.name = 'blobs'
exports.version = "1.0.0"
exports.permissions = {
  anonymous: {allow: ['has', 'get', 'createWants']},
}

exports.init = function (sbot, config) {
  const blobsDir = path.join(config.path, "blobs")
  const privateBlobsDir = path.join(config.path, "private-blobs")
  console.log("blobs dir:", blobsDir)

  function httpGet(url, responseType, cb) {
    var req = new XMLHttpRequest()
    req.timeout = 2000;
    req.onreadystatechange = function() {
      if (req.readyState == 4 && req.status == 200)
        cb(null, req.response)
    }
    req.onerror = function() {
      cb("Error requesting blob")
    }
    req.ontimeout = function () {
      cb("Timeout requesting blob")
    }

    req.open("GET", url, true)
    if (responseType)
      req.responseType = responseType

    req.send()
  }

  function sanitizedPrivatePath(id) {
    return path.join(privateBlobsDir, sanitize(id))
  }

  // we need to store these blobs unencrypted to have a fs url working
  function addPrivate(id, blob, cb) {
    console.log("wrote private to local filesystem:", id)
    const file = raf(sanitizedPrivatePath(id))
    file.write(0, blob, cb)
  }

  function sanitizedPath(id) {
    return path.join(blobsDir, sanitize(id))
  }

  function add(id, blob, cb) {
    console.log("wrote to local filesystem:", id)
    const file = raf(sanitizedPath(id))
    file.write(0, blob, (err) => {
      if (err) return cb(err)

      delete want[id]
      cb()
    })
  }

  function pushBlob(id, cb) {
    if(!isBlobId(id))
      return cb(new Error('invalid hash:'+id))

    push[id] = push[id] || {}
    queue(id, -1)
    cb()
  }

  function privateFsURL(id, cb) {
    var file = chromeFS(sanitizedPrivatePath(id))
    file.stat((err, file) => {
      cb(null, URL.createObjectURL(file))
    })
  }

  function fsURL(id, cb) {
    if (window.IDBMutableFile) // firefox
    {
      cb(null, remoteURL(id))
      return

      // this should be working, but is not?
      // https://github.com/random-access-storage/random-access-idb-mutable-file/issues/6

      const mutableAccess = require('random-access-idb-mutable-file')
      mutableAccess.mount({}).then((requestFile) => {
        var f = requestFile(sanitizedPath(id))
        f.open((err) => {
          f.file.getFile().then((fileObj) => {
            // blob:null/ae825970-3f3a-4834-bc5c-ada3789b83c5
            console.log(URL.createObjectURL(fileObj))
            cb(null, URL.createObjectURL(fileObj))
          })
        })
      })
    }
    else
    {
      var file = chromeFS(sanitizedPath(id))
      file.stat((err, file) => {
        cb(null, URL.createObjectURL(file))
      })
    }
  }

  function remoteURL(id) {
    if (SSB.remoteAddress.includes("wss:"))
      return SSB.remoteAddress.split("~")[0].replace("wss:", "https://") + '/blobs/get/' + id
    else
      return SSB.remoteAddress.split("~")[0].replace("ws:", "http://") + '/blobs/get/' + id
  }

  var zeros = new Buffer(24); zeros.fill(0)

  function unboxBlob(unbox) {
    var key = new Buffer(unbox.replace(/\s/g, '+'), 'base64')
    return BoxStream.createUnboxStream(
      new Buffer(key, 'base64'),
      zeros
    )
  }

  // from ssb-blobs
  var Notify = require('pull-notify')
  var isBlobId = require('ssb-ref').isBlob

  var peers = {}
  var want = {}, push = {}, getting = {}
  var available = {}, streams = {}

  var notify = Notify()

  // FIXME: config
  //sympathy controls whether you'll replicate
  var sympathy = 0
  var stingy = false
  var pushy = 3
  var max = 256*1024

  function isAvailable(id) {
    for(var peer in peers)
      if(available[peer] && available[peer][id] < max && peers[peer])
        return peer
  }

  function get (peer, id) {
    if(getting[id] || !peers[peer]) return

    getting[id] = peer
    var source = peers[peer].blobs.get({key: id, max: max})
    pull(
      source,
      pull.collect(function(err, data) {
        add(id, data, function (err, _id) {
          delete getting[id]
          if(err) {
            if(available[peer]) delete available[peer][id]
            //check if another peer has this.
            //if so get it from them.
            if(peer = isAvailable(id)) get(peer, id)
          }
        })
    }))
  }

  // wants helper
  var send = {}
  function queue (id, hops) {
    if(hops < 0)
      want[id] = hops
    else
      delete want[id]

    send[id] = hops
    var _send = send;
    send = {}
    notify(_send)
  }

  function wants (peer, id, hops) {
    if(Math.abs(hops) > sympathy) return //sorry!
    if(!want[id] || want[id] < hops) {
      want[id] = hops
      queue(id, hops)
      if(peer = isAvailable(id)) {
        get(peer, id)
      }
    }
  }

  function has(peer_id, id, size) {
    if('string' !== typeof peer_id) throw new Error('peer must be string id')
    available[peer_id] = available[peer_id] || {}
    available[peer_id][id] = size
    //if we are broadcasting this blob,
    //mark this peer has it.
    //if N peers have it, we can stop broadcasting.
    if(push[id]) {
      push[id][peer_id] = size
      if(Object.keys(push[id]).length >= pushy) {
        var data = {key: id, peers: push[id]}
        delete push[id]
      }
    }

    if(want[id] && !getting[id] && size < max) get(peer_id, id)
  }

  function onAbort(abortCb) {
    return function (read) {
      return function (abort, cb) {
        if (abort) abortCb(abort, cb)
        else read(null, cb)
      }
    }
  }

  function createWantStream (id) {
    if(!streams[id]) {
      streams[id] = notify.listen()

      //merge in ids we are pushing.
      var w = Object.assign({}, want)
      for(var k in push) w[k] = -1
      streams[id].push(w)
    }
    return pull(streams[id], onAbort(function (err, cb) {
      streams[id] = false
      cb(err)
    }))
  }

  function process (data, peer, cb) {
    var n = 0, res = {}
    for(var id in data) (function (id) {
      if(isBlobId(id) && Number.isInteger(data[id])) {
        if(data[id] < 0 && (stingy !== true || push[id])) { //interpret as "WANT"
          n++
          //check whether we already *HAVE* this file.
          //respond with it's size, if we do.
          const file = raf(sanitizedPath(id))
          file.stat(function (err, stat) {
            if(stat && stat.size) res[id] = stat.size
            else wants(peer, id, data[id] - 1)
            next()
          })
        }
        else if(data[id] > 0) { //interpret as "HAS"
          has(peer, id, data[id])
        }
      }
    }(id))

    function next () {
      if(--n) return
      cb(null, res)
    }
  }

  function isEmpty (o) {
    for(var k in o) return false
    return true
  }

  function wantSink (peer) {
    createWantStream(peer.id) //set streams[peer.id]

    var modern = false
    return pull.drain(function (data) {
      modern = true
      //respond with list of blobs you already have,
      process(data, peer.id, function (err, has_data) {
        //(if you have any)
        if(!isEmpty(has_data) && streams[peer.id]) streams[peer.id].push(has_data)
      })
    }, function (err) {
      if(peers[peer.id] == peer) {
        delete peers[peer.id]
        delete available[peer.id]
        delete streams[peer.id]
      }
    })
  }

  sbot.on('rpc:connect', function (rpc) {
    peers[rpc.id] = rpc
    pull(rpc.blobs.createWants(), wantSink(rpc))
  })
  // end ssb-blobs

  function hash(blob, cb)
  {
    var hash = require('crypto').createHash('sha256')
    hash.update(blob)
    cb(null, hash.digest('base64') + '.sha256')
  }

  return {
    hash,
    add,
    addPrivate,
    has,
    push: pushBlob,

    createWants: function () {
      return createWantStream(this.id)
    },

    get: function(opts) {
      var stream = defer.source()

      var id = opts.key || opts.hash

      const file = raf(sanitizedPath(id))
      file.stat((err, stat) => {
        if (opts.max != null && opts.max < stat.size) {
          stream.abort(new Error('incorrect file length,'
                                 + ' requested:' + opts.size + ' file was:' + stat.size
                                 + ' for file:' + id))
        } else {
          file.read(0, stat.size, (err, data) => {
            if (err) stream.abort(err)
            stream.resolve(pull.once(data))
          })
        }
      })

      return stream
    },

    // internal

    privateGet: function(id, unboxKey, cb) {
      const file = raf(sanitizedPrivatePath(id))
      file.stat((err, stat) => {
        if (stat.size == 0) {
          httpGet(remoteURL(id), 'arraybuffer', (err, data) => {
            if (err) return cb(err)
            pull(
              pull.once(Buffer.from(data)),
              unboxBlob(unboxKey),
              pull.collect((err, decrypted) => {
                if (decrypted) {
                  addPrivate(id, new Blob(decrypted), () => {
                    console.log("wrote private blob")
                    privateFsURL(id, cb)
                  })
                }
                else
                {
                  console.log("failed to decrypt", err)
                  cb(err)
                }
              })
            )
          })
        }
        else
        {
          privateFsURL(id, cb)
        }
      })
    },

    localGet: function (id, cb) {
      const file = raf(sanitizedPath(id))
      file.stat((err, stat) => {
        if (stat && stat.size == 0) {
          httpGet(remoteURL(id), 'blob', (err, data) => {
            if (err) cb(err)
            else if (data.size < max)
              add(id, data, () => { fsURL(id, cb) })
            else
              cb(null, remoteURL(id))
          })
        }
        else
        {
          //console.log("reading from local filesystem")
          fsURL(id, cb)
        }
      })
    },

    remoteGet: function(id, type, cb) {
      httpGet(remoteURL(id), type, cb)
    },

    fsURL,
    privateFsURL,
    remoteURL
  }
}
