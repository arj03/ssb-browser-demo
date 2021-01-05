exports.getPeople = function(cb) {
  const profiles = SSB.db.getIndex('profiles').getProfiles()
  let people = []
  for (var id in profiles) {
    const profile = profiles[id]
    if (profile.image) {
      const profileId = id
      SSB.net.blobs.localGet(profile.image, (err, url) => {
        people.push({
          id: profileId,
          name: profile.name || profileId,
          image: err ? '' : url
        })
      })
    } else {
      people.push({
        id,
        name: profile.name || id,
        image: ''
      })
    }
  }

  cb(null, people)
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
