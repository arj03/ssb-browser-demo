SSB.getProfileNameAsync = function(profileId, cb) {
  SSB.net.about.socialValue({ key: 'name', dest: profileId }, (err, value) => {
    if (err) {
      console.log("Got error from ssb-social-value: " + err)
      return cb(err)
    }

    cb(null, value)
  })
}

SSB.getProfileAsync = function(profileId, cb) {
  const keysWeWant = ['name', 'description', 'image']
  SSB.net.about.latestValues({ keys: keysWeWant, dest: profileId }, (err, profile) => {
    if (err) {
      console.log("Got error from ssb-social-value: " + err)
      return cb(err)
    }

    if (typeof profile.image === 'object' && profile.image.link)
      profile.image = profile.image.link
    
    cb(null, profile)
  })
}
