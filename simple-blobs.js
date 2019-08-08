// ssb-blobs has a lot of fs code
// this is a simple example of using chrome fs to store blobs

const path = require('path')
const raf = require('polyraf')
const pull = require('pull-stream')
const BoxStream = require('pull-box-stream')

module.exports = function (dir) {
  const blobsDir = path.join(dir, "blobs")
  console.log("blobs dir:", blobsDir)
  
  function httpGet(url, responseType, cb) {
    var req = new XMLHttpRequest()
    req.timeout = 1000;
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

  function add(hash, blob, cb) {
    console.log("wrote to local filesystem")
    const file = raf(path.join(blobsDir, hash))
    file.write(0, blob, cb)
  }

  const maxSize = 256 * 1024

  function fsURL(hash) {
    return 'filesystem:file:///persistent/.ssb-lite/blobs/' + hash
  }

  function remoteURL(hash) {
    return SSB.remoteAddress.split("~")[0].replace("ws:", "http://") + '/blobs/get/' + hash
  }
  
  var zeros = new Buffer(24); zeros.fill(0)

  function unboxBlob(unbox) {
    var key = new Buffer(unbox.replace(/\s/g, '+'), 'base64')
    return BoxStream.createUnboxStream(
      new Buffer(key, 'base64'),
      zeros
    )
  }

  return {
    add,

    get: function (hash, unbox, cb) {
      const file = raf(path.join(blobsDir, hash))
      file.stat((err, stat) => {
	if (stat.size == 0) {
	  if (unbox)
	  {
	    httpGet(remoteURL(hash), 'arraybuffer', (err, data) => {
	      pull(
		pull.once(Buffer.from(data)),
		unboxBlob(unbox),
		pull.collect((err, decrypted) => {
		  if (decrypted) {
		    add(hash, new Blob(decrypted), () => {
		      console.log("wrote private blob")
		    })
		  }
		  else
		  {
		    console.log("failed to decrypt", err)
		  }
		})
	      )
	    })
	  }
	  else
	  {
	    httpGet(remoteURL(hash), 'blob', (err, data) => {
	      if (err) cb(err)
	      else if (data.size < maxSize)
		add(hash, data, () => {
		  cb(null, fsURL(hash))
		})
	      else
		cb(null, remoteURL(hash))
	    })
	  }
	}
	else
	{
	  //console.log("reading from local filesystem")
	  cb(null, fsURL(hash))
	}
      })
    },

    remoteGet: function(hash, type, cb) {
      httpGet(remoteURL(hash), type, cb)
    },

    fsURL,
    remoteURL
  }
}
