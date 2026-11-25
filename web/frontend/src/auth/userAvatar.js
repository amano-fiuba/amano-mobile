const DEFAULT_AVATAR = '/avatar-default.png'

// Foto propia de la sesión, o el avatar por defecto (FR-005 de 002).
export function userAvatarUrl(user) {
  return user?.hasCustomAvatar && user.avatarUrl ? user.avatarUrl : DEFAULT_AVATAR
}
