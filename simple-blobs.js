// ssb-blobs has a lot of fs code
// this is a simple example of using chrome fs to store blobs

const path = require('path')
const ras = require('random-access-chrome-file')

module.exports = function (dir) {
  const blobsDir = path.join(dir, "blobs")
  console.log("blobs dir:", blobsDir)
  
  function httpGet(url, useBlob, cb) {
    var req = new XMLHttpRequest()
    req.onreadystatechange = function() {
      if (req.readyState == 4 && req.status == 200)
        cb(null, req.response)
    }
    req.onerror = function() {
      cb("Error requesting blob")
    }

    req.open("GET", url, true)
    if (useBlob)
      req.responseType = 'blob'

    req.send()
  }

  function add(hash, blob, cb) {
    console.log("wrote to local filesystem")
    const file = ras(path.join(blobsDir, hash))
    file.write(0, blob, cb)
  }

  const maxSize = 256 * 1024

  function fsURL(hash) {
    return 'filesystem:file:///persistent/.ssb-lite/blobs/' + hash
  }

  function remoteURL(hash) {
    return SSB.remoteAddress.split("~")[0].replace("ws:", "http://") + '/blobs/get/' + hash
  }
  
  return {
    add,

    get: function (hash, cb) {
      const file = ras(path.join(blobsDir, hash))
      file.stat((err, stat) => {
	if (stat.size == 0) {
	  httpGet(remoteURL(hash), true, (err, data) => {
	    if (err) cb(err)
	    else if (data.size < maxSize)
	      add(hash, data, () => {
		cb(null, fsURL(hash))
	      })
	    else
	      cb(null, remoteURL(hash))
	  })
	}
	else
	{
	  //console.log("reading from local filesystem")
	  cb(null, fsURL(hash))
	}
      })
    },

    remoteGet: function(hash, cb) {
      httpGet(remoteURL(hash), false, cb)
    },

    fsURL,
    remoteURL
  }
}
