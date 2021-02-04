SSB.getProfileName = function(profileId) {
  const profile = SSB.db.getIndex("profiles").getProfile(profileId)
  if (profile) return profile.name
  else return ''
}

SSB.getProfile = function(profileId) {
  return SSB.db.getIndex("profiles").getProfile(profileId)
}
