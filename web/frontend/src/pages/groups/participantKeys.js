// Keys of the participants of a group expense (specs/017-debt-states, US3).
// Users and simulated profiles live in different id spaces, so a user 7 and a
// profile 7 must never share a key (research.md D7): "u:7" vs "s:7".

/** Key of a row of GET /api/groups/{id}/members. */
export function participantKey(member) {
  return member.userId != null ? `u:${member.userId}` : `s:${member.simulatedProfileId}`
}

/** Participant of the POST body for a key. */
export function toParticipant(key) {
  const [kind, id] = String(key).split(':')
  return kind === 'u'
    ? { type: 'REGISTERED', userId: Number(id) }
    : { type: 'SIMULATED', simulatedProfileId: Number(id) }
}

/** User id of a "u:" key, or null. */
export function userIdOf(key) {
  const [kind, id] = String(key ?? '').split(':')
  return kind === 'u' && id ? Number(id) : null
}
