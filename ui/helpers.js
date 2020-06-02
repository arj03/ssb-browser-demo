exports.getPeople = function() {
  return [] // FIXME
  
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

exports.handleFileSelect = function(ev, isPrivate, cb) {
  var opts = {
    stripExif: true,
    quality: 0.9,
    resize: { width: 1024, height: 1024 },
    isPrivate
  }

  SSB.blobFiles(ev.target.files, SSB.net, opts, (err, res) => {
    cb(null, " ![" + res.name + "](" + res.link + ")")
  })
}
