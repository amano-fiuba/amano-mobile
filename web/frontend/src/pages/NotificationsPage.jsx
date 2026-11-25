import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { getNotifications, markAllRead, markRead } from '../api/notificationsClient'
import NotificationRow from '../components/NotificationRow'
import NotificationPreferencesModal from '../components/NotificationPreferencesModal'
import { SNACKBAR_ERROR_MS, useSnackbar } from '../components/Snackbar'
import { MARK_READ_ERROR_MESSAGE, openNotification } from '../utils/notificationTarget'
import './NotificationsPage.scss'

export const NOTIFICATIONS_LOAD_ERROR_MESSAGE =
  'No pudimos cargar tus notificaciones. Intentá nuevamente'
export const NO_NOTIFICATIONS_MESSAGE = 'No tenés notificaciones'
export const NO_UNREAD_MESSAGE = 'No tenés notificaciones sin leer'
export const ALL_FILTER = 'Todas'
export const UNREAD_FILTER = 'No leídas'
export const MARK_ALL_LABEL = 'Marcar todas como leídas'
export const PREFERENCES_LABEL = 'Configuración de notificaciones'
export const LOAD_MORE_LABEL = 'Cargar más'

/** Dedicated inbox of feature 035 (US2, US3, US4). */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const [filter, setFilter] = useState('all')
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const load = useCallback(async (cursor = null) => {
    // Keep the effect body free of synchronous state updates.
    await Promise.resolve()
    setStatus('loading')
    setError('')
    const result = await getNotifications({ limit: 20, order: 'history', before: cursor })
    if (!result.ok) {
      setStatus('error')
      setError(NOTIFICATIONS_LOAD_ERROR_MESSAGE)
      return
    }
    setNotifications((current) => cursor ? [...current, ...result.notifications] : result.notifications)
    setUnreadCount(result.unreadCount)
    setNextCursor(result.nextCursor)
    setStatus('ready')
  }, [])

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      await Promise.resolve()
      if (!cancelled) await load()
    }
    start()
    return () => {
      cancelled = true
    }
  }, [load, reloadToken])

  const applyRead = useCallback((id, readAt) => {
    setNotifications((current) => current.map((item) => item.id === id
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

  const handleOpen = (notification) => openNotification(notification, {
    navigate,
    markRead: markAsRead,
    notify: (message) => showSnackbar?.(message, SNACKBAR_ERROR_MS),
  })

  async function markEverything() {
    setBusy(true)
    const result = await markAllRead()
    setBusy(false)
    if (!result.ok) {
      showSnackbar?.(MARK_READ_ERROR_MESSAGE, SNACKBAR_ERROR_MS)
      return
    }
    setNotifications((current) => current.map((item) => ({
      ...item,
      readAt: item.readAt ?? new Date().toISOString(),
    })))
    setUnreadCount(0)
  }

  const visible = filter === 'unread' ? notifications.filter((item) => !item.readAt) : notifications

  return (
    <main className="page notifications-page">
      <div className="notifications-page__header">
        <h1>Notificaciones</h1>
        <div className="notifications-page__actions">
          <button
            type="button"
            className="notifications-page__action"
            onClick={markEverything}
            disabled={busy || unreadCount === 0}
          >
            {MARK_ALL_LABEL}
          </button>
          <button
            type="button"
            className="notifications-page__action"
            aria-expanded={modalOpen}
            onClick={() => setModalOpen((open) => !open)}
          >
            {modalOpen ? 'Cerrar' : PREFERENCES_LABEL}
          </button>
        </div>
      </div>

      <NotificationPreferencesModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <div role="tablist" aria-label="Filtro de notificaciones" className="notifications-page__filters">
        {[
          { id: 'all', label: ALL_FILTER },
          { id: 'unread', label: UNREAD_FILTER },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`notifications-page__tab${filter === tab.id ? ' is-active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={filter === 'all' ? ALL_FILTER : UNREAD_FILTER}>
        {status === 'loading' && <p role="status" className="notifications-page__state">Cargando notificaciones…</p>}
        {status === 'error' && (
          <div role="alert" className="notifications-page__state notifications-page__state--error">
            <p>{error}</p>
            <button
              type="button"
              className="notifications-page__button"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Reintentar
            </button>
          </div>
        )}
        {status === 'ready' && visible.length === 0 && (
          <p className="notifications-page__state">
            {filter === 'unread' ? NO_UNREAD_MESSAGE : NO_NOTIFICATIONS_MESSAGE}
          </p>
        )}
        {status === 'ready' && visible.length > 0 && (
          <ul className="notifications-page__list">
            {visible.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={handleOpen}
                onMarkRead={markAsRead}
              />
            ))}
          </ul>
        )}
      </div>

      {status === 'ready' && nextCursor && (
        <button
          type="button"
          className="notifications-page__action notifications-page__action--more"
          onClick={() => load(nextCursor)}
        >
          {LOAD_MORE_LABEL}
        </button>
      )}

    </main>
  )
}
