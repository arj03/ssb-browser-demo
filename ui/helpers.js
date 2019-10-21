const resizer = require('browser-image-resizer').readAndCompressImage

exports.getPeople = function() {
  const last = SSB.db.last.get()

  const people = []
  
  for (let id in SSB.profiles) {
    const profile = SSB.profiles[id]

    if (profile.image && last[id])
      SSB.net.blobs.localGet(profile.image, (err, url) => {
        people.push({
          id: id,
          name: profile.name || id,
          image: err ? '' : url
        })
      })
    else if (last[id])
      people.push({
        id: id,
        name: profile.name || id,
        image: ''
      })
  }

  return people
}

exports.handleFileSelect = function(ev, cb) {
  const file = ev.target.files[0]

  if (!file) return cb()

  var resizeConfig = {
    quality: 0.9,
    maxWidth: 1024,
    maxHeight: 1024,
    autoRotate: true
  }

  resizer(file, resizeConfig).then(resizedImage => {
    resizedImage.arrayBuffer().then(function (buffer) {
      SSB.net.blobs.hash(new Uint8Array(buffer), (err, digest) => {
        SSB.net.blobs.add("&" + digest, file, (err) => {
          if (!err) {
            SSB.net.blobs.push("&" + digest, (err) => {
              cb(null, " ![" + file.name + "](&" + digest + ")")
            })
          }
        })
      })
    })
  })
}
