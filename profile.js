// FIXME: cache invalidation (timeout?)
let profileCache = {}

SSB.getProfileName = function(profileId) {
  if (profileCache[profileId]) return profileCache[profileId].name
  else return profileId
}

SSB.getProfile = function(profileId) {
  if (profileCache[profileId]) return profileCache[profileId]
  else {
    // fire off a getProfileAsync so it's ready the next time around
    SSB.getProfileAsync(profileId, () => {})
    return {}
  }
}

SSB.getProfileNameAsync = function(profileId, cb) {
  if (profileCache[profileId]) return cb(null, profileCache[profileId].name)

  SSB.net.about.socialValue({ key: 'name', dest: profileId }, (err, value) => {
    if (err) {
      console.log("Got error from ssb-social-value: " + err)
      return cb(err)
    }

    cb(null, value)
  })
}

SSB.getProfileAsync = function(profileId, cb) {
  if (profileCache[profileId]) return cb(null, profileCache[profileId])

  const keysWeWant = ['name', 'description', 'image']
  SSB.net.about.latestValues({ keys: keysWeWant, dest: profileId }, (err, profile) => {
    if (err) {
      console.log("Got error from ssb-social-value: " + err)
      return cb(err)
    }

    if (profile.image && typeof profile.image === 'object' && profile.image.link)
      profile.image = profile.image.link

    profileCache[profileId] = profile

    if (profile.image) {
      SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
        profileCache[profileId].imageURL = err ? '' : url
      })
    }
    
    cb(null, profile)
  })
}
