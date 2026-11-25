import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { FRIEND_REQUESTS_CHANGED_EVENT } from '../api/friendsClient'
import { getNotifications, markRead } from '../api/notificationsClient'
import { useDismiss } from '../hooks/useDismiss'
import { MARK_READ_ERROR_MESSAGE, openNotification } from '../utils/notificationTarget'
import { BellIcon } from './NavIcons'
import NotificationRow from './NotificationRow'
import { SNACKBAR_ERROR_MS, useSnackbar } from './Snackbar'

export const NO_NOTIFICATIONS_MESSAGE = 'No tenés notificaciones'
export const NOTIFICATIONS_ERROR_MESSAGE = 'No se pudieron cargar tus notificaciones'

function buttonLabel(count) {
  if (count === 0) return 'Notificaciones'
  return count === 1 ? 'Notificaciones, 1 sin leer' : `Notificaciones, ${count} sin leer`
}

/** Header bell and quick popover of feature 035 (US1, US3, US4). */
export default function NotificationsMenu() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [failed, setFailed] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const containerRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(containerRef, isOpen, close)

  useEffect(() => {
    let cancelled = false
    getNotifications({ limit: 5, order: 'unread-first' }).then((result) => {
      if (cancelled) return
      setFailed(!result.ok)
      if (!result.ok) return
      setItems(result.notifications.slice(0, 5))
      setUnreadCount(result.unreadCount)
    })
    return () => {
      cancelled = true
    }
  }, [pathname, reloadToken])

  useEffect(() => {
    const reload = () => setReloadToken((token) => token + 1)
    window.addEventListener(FRIEND_REQUESTS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(FRIEND_REQUESTS_CHANGED_EVENT, reload)
  }, [])

  const applyRead = useCallback((id, readAt) => {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, readAt: readAt ?? new Date().toISOString() }
      : item))
    setUnreadCount((current) => Math.max(0, current - 1))
  }, [])

  const markAsRead = useCallback(async (id) => {
    const result = await markRead(id)
    if (result.ok) applyRead(id, result.notification?.readAt)
    else showSnackbar?.(MARK_READ_ERROR_MESSAGE, SNACKBAR_ERROR_MS)
    return result
  }, [applyRead, showSnackbar])

  const handleOpen = async (notification) => {
    const opened = await openNotification(notification, {
      navigate,
      markRead: markAsRead,
      notify: (message) => showSnackbar?.(message, SNACKBAR_ERROR_MS),
    })
    if (opened) close()
  }

  const handleToggle = () => {
    if (!isOpen) setReloadToken((token) => token + 1)
    setIsOpen(!isOpen)
  }

  return (
    <div className="app-menu" ref={containerRef}>
      <button
        type="button"
        className="app-header__action"
        aria-label={buttonLabel(unreadCount)}
        aria-expanded={isOpen}
        title="Notificaciones"
        onClick={handleToggle}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="app-header__badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="app-menu__panel app-menu__panel--end" aria-label="Notificaciones" role="region">
          <h2>Notificaciones</h2>
          {failed && <p role="alert">{NOTIFICATIONS_ERROR_MESSAGE}</p>}
          {!failed && items.length === 0 && <p>{NO_NOTIFICATIONS_MESSAGE}</p>}
          {!failed && items.length > 0 && (
            <ul className="notifications-menu__list">
              {items.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                  showMarkRead={false}
                  showTime={false}
                  showStatus={false}
                />
              ))}
            </ul>
          )}
          <div className="notifications-menu__footer">
            <Link to="/notifications" onClick={close}>Ver todas las notificaciones</Link>
          </div>
        </div>
      )}
    </div>
  )
}
