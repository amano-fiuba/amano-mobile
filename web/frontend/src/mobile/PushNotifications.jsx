import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { FRIEND_REQUESTS_CHANGED_EVENT } from '../api/friendsClient'
import { markRead } from '../api/notificationsClient'
import { useSnackbar } from '../components/Snackbar'
import {
  enablePush,
  listen,
  notificationIdFromAction,
  pushAvailable,
  routeFromNotification,
} from './nativePush'

// Notificaciones en el celular (amano-mobile specs/002-diseno-movil-y-notificaciones, US4). No dibuja nada.
// - Con sesión: pide permiso y registra el teléfono (una vez por sesión).
// - Al tocar una notificación: la marca como leída en la bandeja (web-035) y
//   abre la pantalla que indica (`data.route`), como un clic en la campana.
// - Con la app abierta: Android no muestra la notificación, así que se avisa
//   con el snackbar y se recarga la campanita.
export default function PushNotifications({ available = pushAvailable() }) {
  const { user } = useAuth() ?? {}
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const userId = user?.id

  useEffect(() => {
    if (!available) return undefined
    const stopAction = listen('pushNotificationActionPerformed', async (action) => {
      const id = notificationIdFromAction(action)
      if (id) {
        // Si falla, igual se abre el destino: la notificación queda sin leer.
        await markRead(id).catch(() => null)
        window.dispatchEvent(new Event(FRIEND_REQUESTS_CHANGED_EVENT))
      }
      const route = routeFromNotification(action)
      navigate(route ?? '/notifications')
    })
    const stopReceived = listen('pushNotificationReceived', (notification) => {
      window.dispatchEvent(new Event(FRIEND_REQUESTS_CHANGED_EVENT))
      const text = [notification?.title, notification?.body].filter(Boolean).join(': ')
      if (text) showSnackbar?.(text)
    })
    return () => {
      stopAction()
      stopReceived()
    }
  }, [available, navigate, showSnackbar])

  useEffect(() => {
    if (!available || !userId) return
    enablePush().catch(() => {})
  }, [available, userId])

  return null
}
