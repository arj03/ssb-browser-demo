// ssb-blobs has a lot of fs code
// this is a simple example of using chrome fs to store blobs

const path = require('path')
const ras = require('random-access-chrome-file')

module.exports = function (dir) {
  const blobsDir = path.join(dir, "blobs")
  console.log("blobs dir:", blobsDir)
  
  function httpGet(url, cb) {
    var req = new XMLHttpRequest()
    req.onreadystatechange = function() {
      console.log(req)
      if (req.readyState == 4 && req.status == 200)
        cb(null, req.response)
    }

    req.open("GET", url, true)
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
    return 'http://localhost:8989/blobs/get/' + hash
  }
  
  return {
    add,

    get: function (hash, cb) {
      const file = ras(path.join(blobsDir, hash))
      file.stat((err, stat) => {
	if (stat.size == 0) {
	  httpGet(remoteURL(hash), (err, data) => {
	    if (data.size < maxSize)
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

    fsURL
  }
}
