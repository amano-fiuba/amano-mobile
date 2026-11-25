// Deep links of feature 035 (spec FR-016..FR-022). The destination comes from
// the structured `target`, never from the message text.

export const MISSING_TARGET_MESSAGE = 'El destino de esta notificación ya no está disponible'
export const INCOMPLETE_TARGET_MESSAGE = 'Esta notificación no tiene un destino válido'
export const MARK_READ_ERROR_MESSAGE =
  'No pudimos marcar la notificación como leída. Intentá nuevamente'

const SECTION_BY_TYPE = {
  REMINDER: '/groups',
  DEBT_WHISTLE: '/groups',
  GROUP_EXPENSE: '/groups',
  DEBT_OVERDUE: '/groups',
  PAYER_DUE_NOTICE: '/groups',
  PAYMENT_RECORDED: '/groups',
  FRIEND_REQUEST: '/friends',
  FRIEND_ACTIVITY: '/friends',
}

/**
 * Returns `{ path, missingTarget }`. A missing/incomplete destination keeps the
 * notice readable and takes the person to the general section with a notice.
 */
export function resolveNotificationTarget(notification) {
  const target = notification?.target ?? {}
  switch (target.kind) {
    case 'GROUP':
      return target.groupId != null
        ? { path: `/groups/${target.groupId}`, missingTarget: false }
        : missing(notification)
    case 'DEBT':
      if (target.debtId == null) return missing(notification)
      return target.groupId != null
        ? { path: `/groups/${target.groupId}/debts?debt=${target.debtId}`, missingTarget: false }
        : { path: `/activity?debt=${target.debtId}`, missingTarget: false }
    case 'FRIEND_REQUEST':
      return { path: '/friends', missingTarget: false }
    default:
      return missing(notification)
  }
}

function missing(notification) {
  return {
    path: SECTION_BY_TYPE[notification?.type] ?? '/notifications',
    missingTarget: true,
  }
}

/**
 * Shared click flow for the popover and the inbox: mark as read FIRST, then
 * navigate. A marking failure keeps the user in place and shows an error
 * snackbar, so it never navigates to a wrong destination (FR-022).
 */
export async function openNotification(notification, { navigate, markRead, notify }) {
  const result = await markRead(notification.id)
  if (!result?.ok) {
    notify?.(MARK_READ_ERROR_MESSAGE, 4000)
    return false
  }
  const { path, missingTarget } = resolveNotificationTarget(notification)
  navigate(path)
  if (missingTarget) {
    notify?.(notification.target?.kind === 'DEBT' ? INCOMPLETE_TARGET_MESSAGE : MISSING_TARGET_MESSAGE, 4000)
  }
  return true
}
