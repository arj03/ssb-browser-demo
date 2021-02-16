SSB.getProfileName = function(profileId) {
  const profile = SSB.db.getIndex("aboutSelf").getProfile(profileId)
  if (profile) return profile.name
  else return ''
}

SSB.getProfile = function(profileId) {
  return SSB.db.getIndex("aboutSelf").getProfile(profileId)
}

SSB.searchProfiles = function(search, results = 10) {
  const profilesDict = SSB.db.getIndex("aboutSelf").getProfiles()
  const profiles = []
  for (let p in profilesDict) {
    const pValue = profilesDict[p]
    profiles.push({ id: p, name: pValue.name, imageURL: pValue.imageURL })
  }
  const lowerSearch = search.toLowerCase()
  return profiles.filter(x => x.name && x.name.toLowerCase().startsWith(lowerSearch)).slice(0, results)
}
