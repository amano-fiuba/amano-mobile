// Full name of a friend of GET /api/users/me/friends (013): last name is optional.
export function friendName(friend) {
  if (!friend) return ''
  return friend.lastName ? `${friend.firstName} ${friend.lastName}` : friend.firstName
}
