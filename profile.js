// FIXME: cache invalidation (timeout?)
let profileCache = {}
let fullProfileCache = {}

SSB.getProfileName = function(profileId) {
  if (profileCache[profileId]) return profileCache[profileId].name
  else return profileId
}

SSB.getProfile = function(profileId) {
  if (profileCache[profileId] && profileCache[profileId].image) return profileCache[profileId]
  else {
    // fire off a getProfileAsync so it's ready the next time around
    SSB.getProfileAsync(profileId, () => {})
    return {}
  }
}

SSB.getFullProfile = function(profileId) {
  if (fullProfileCache[profileId] && fullProfileCache[profileId].description) return fullProfileCache[profileId]
  else {
    // fire off a getProfileAsync so it's ready the next time around
    SSB.getFullProfileAsync(profileId, () => {})
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

    if (!profileCache[profileId])
      profileCache[profileId] = { name: value }
    
    cb(null, value)
  })
}

SSB.getProfileAsync = function(profileId, cb) {
  if (profileCache[profileId] && profileCache[profileId].image) return cb(null, profileCache[profileId])

  console.log("getting profile", profileId)

  SSB.getProfileNameAsync(profileId, (err) => {
    const profile = profileCache[profileId]

    SSB.net.about.socialValue({ key: 'image', dest: profileId }, (err, value) => {
      if (err) {
        console.log("Got error from ssb-social-value: " + err)
        return cb(err)
      }

      profile.image = value

      if (profile.image && typeof profile.image === 'object' && profile.image.link)
        profile.image = profile.image.link

      if (profile.image) {
        SSB.net.blobs.localProfileGet(profile.image, (err, url) => {
          profileCache[profileId].imageURL = err ? '' : url
        })
      }

      profileCache[profileId] = profile

      cb(null, profile)
    })
  })
}

SSB.getFullProfileAsync = function(profileId, cb) {
  if (fullProfileCache[profileId] && fullProfileCache[profileId].description) return cb(null, fullProfileCache[profileId])

  console.log("getting full profile", profileId)

  SSB.getProfileAsync(profileId, (profile) => {
    SSB.net.about.socialValue({ key: 'description', dest: profileId }, (err, value) => {
      if (err) {
        console.log("Got error from ssb-social-value: " + err)
        return cb(err)
      }

      fullProfileCache[profileId] = Object.assign({}, profile, { description: value })

      cb(null, fullProfileCache[profileId])
    })
  })
}
