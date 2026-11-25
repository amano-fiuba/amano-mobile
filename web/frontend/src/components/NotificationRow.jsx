import { notificationDate } from '../utils/notificationDate'
import './NotificationRow.scss'

/** One notification of the inbox or the header popover (035 FR-002, FR-009, FR-011). */
export default function NotificationRow({
  notification,
  onOpen,
  onMarkRead,
  showMarkRead = true,
  showTime = true,
  showStatus = true,
}) {
  const unread = !notification.readAt
  const hasFooter = showTime || (unread && (showStatus || showMarkRead))
  return (
    <li
      className={`notification-row${unread ? ' notification-row--unread' : ''}`}
      data-read={unread ? 'unread' : 'read'}
    >
      <button
        type="button"
        className="notification-row__body"
        aria-label={`${notification.title}. ${unread ? 'No leída' : 'Leída'}. Abrir`}
        onClick={() => onOpen(notification)}
      >
        <span className="notification-row__title">{notification.title}</span>
        <span className="notification-row__message">{notification.message}</span>
      </button>
      {hasFooter && (
        <div className="notification-row__footer">
          {showTime && <span className="notification-row__meta">{notificationDate(notification.createdAt)}</span>}
          {unread && showStatus && (
            <span className="notification-row__label">
              {showTime && <span className="notification-row__separator" aria-hidden="true">• </span>}
              No leída
            </span>
          )}
          {unread && showMarkRead && (
            <button
              type="button"
              className="notification-row__mark"
              aria-label={`Marcar como leída: ${notification.title}`}
              onClick={() => onMarkRead(notification.id)}
            >
              Marcar como leída
            </button>
          )}
        </div>
      )}
    </li>
  )
}
