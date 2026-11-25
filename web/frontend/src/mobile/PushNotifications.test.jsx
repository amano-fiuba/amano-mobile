import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PushNotifications from './PushNotifications'
import { SnackbarProvider } from '../components/Snackbar'
import { FRIEND_REQUESTS_CHANGED_EVENT } from '../api/friendsClient'

const handlers = {}
const enablePush = vi.fn(async () => 'granted')

const markRead = vi.fn(async () => ({ ok: true }))

vi.mock('./nativePush', () => ({
  pushAvailable: () => true,
  enablePush: () => enablePush(),
  listen: (eventName, handler) => {
    handlers[eventName] = handler
    return () => delete handlers[eventName]
  },
  routeFromNotification: (action) => action?.notification?.data?.route ?? null,
  notificationIdFromAction: (action) => Number(action?.notification?.data?.notificationId) || null,
}))

vi.mock('../api/notificationsClient', () => ({ markRead: (id) => markRead(id) }))

let user = { id: 7, firstName: 'Ana' }
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user }) }))

afterEach(() => {
  enablePush.mockClear()
  markRead.mockClear()
  user = { id: 7, firstName: 'Ana' }
})

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SnackbarProvider>
        <PushNotifications available />
        <Routes>
          <Route path="/" element={<p>Inicio</p>} />
          <Route path="/friends" element={<p>Pantalla de amigos</p>} />
          <Route path="/notifications" element={<p>Bandeja</p>} />
        </Routes>
      </SnackbarProvider>
    </MemoryRouter>,
  )
}

describe('PushNotifications', () => {
  it('con sesión registra el teléfono', async () => {
    renderAt()
    await waitFor(() => expect(enablePush).toHaveBeenCalledTimes(1))
  })

  it('sin sesión no pide permiso', () => {
    user = null
    renderAt()
    expect(enablePush).not.toHaveBeenCalled()
  })

  it('al tocar la notificación la marca como leída y abre la pantalla indicada', async () => {
    renderAt()
    handlers.pushNotificationActionPerformed({
      notification: { data: { route: '/friends', notificationId: '40' } },
    })
    expect(await screen.findByText('Pantalla de amigos')).toBeInTheDocument()
    expect(markRead).toHaveBeenCalledWith(40)
  })

  it('sin ruta abre la bandeja de notificaciones', async () => {
    renderAt()
    handlers.pushNotificationActionPerformed({ notification: { data: {} } })
    expect(await screen.findByText('Bandeja')).toBeInTheDocument()
    expect(markRead).not.toHaveBeenCalled()
  })

  it('con la app abierta avisa con el snackbar y recarga la campanita', async () => {
    const reload = vi.fn()
    window.addEventListener(FRIEND_REQUESTS_CHANGED_EVENT, reload)
    renderAt()

    handlers.pushNotificationReceived({
      title: 'Nueva solicitud de amistad',
      body: 'Bruno Díaz te envió una solicitud de amistad',
    })

    expect(
      await screen.findByText('Nueva solicitud de amistad: Bruno Díaz te envió una solicitud de amistad'),
    ).toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
    window.removeEventListener(FRIEND_REQUESTS_CHANGED_EVENT, reload)
  })

  it('en la web no hace nada', () => {
    render(
      <MemoryRouter>
        <PushNotifications available={false} />
      </MemoryRouter>,
    )
    expect(enablePush).not.toHaveBeenCalled()
  })
})
