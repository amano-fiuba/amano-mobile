import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsMenu, {
  NOTIFICATIONS_ERROR_MESSAGE,
  NO_NOTIFICATIONS_MESSAGE,
} from './NotificationsMenu'

const { getNotifications, markRead } = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markRead: vi.fn(),
}))

vi.mock('../api/notificationsClient', () => ({ getNotifications, markRead }))
vi.mock('../api/friendsClient', () => ({ FRIEND_REQUESTS_CHANGED_EVENT: 'friend-requests-changed' }))

const notice = (id, type = 'GROUP_EXPENSE', unread = true) => ({
  id,
  type,
  title: `Aviso ${id}`,
  message: 'Texto del aviso',
  createdAt: new Date(Date.now() - id * 60000).toISOString(),
  readAt: unread ? null : new Date().toISOString(),
  target: { kind: 'GROUP', groupId: 42 },
})

function renderMenu() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<><NotificationsMenu /><p>Afuera</p></>} />
        <Route path="/notifications" element={<p>Bandeja</p>} />
        <Route path="/groups/:id" element={<p>Grupo 42</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  for (const mock of [getNotifications, markRead]) mock.mockReset()
  getNotifications.mockResolvedValue({
    ok: true, notifications: [notice(1)], unreadCount: 1, nextCursor: null,
  })
  markRead.mockResolvedValue({ ok: true, notification: notice(1, 'GROUP_EXPENSE', false) })
})

describe('NotificationsMenu (035 US1, US3, US4)', () => {
  it('muestra el contador de no leídas y hasta cinco avisos recientes', async () => {
    getNotifications.mockResolvedValue({
      ok: true,
      notifications: Array.from({ length: 7 }, (_, index) => notice(index + 1)),
      unreadCount: 12,
      nextCursor: null,
    })
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 12 sin leer' }))

    expect(getNotifications).toHaveBeenCalledWith({ limit: 5, order: 'unread-first' })
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('9+')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/hace \d+ (min|h)/)).not.toBeInTheDocument()
    expect(screen.queryByText('No leída')).not.toBeInTheDocument()
  })

  it('pide los avisos con orden unread-first y muestra el estado vacío', async () => {
    getNotifications.mockResolvedValue({ ok: true, notifications: [], unreadCount: 0, nextCursor: null })
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    expect(await screen.findByText(NO_NOTIFICATIONS_MESSAGE)).toBeInTheDocument()
    expect(getNotifications).toHaveBeenCalledWith({ limit: 5, order: 'unread-first' })
  })

  it('informa el error de carga sin romper la barra', async () => {
    getNotifications.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderMenu()

    await user.click(await screen.findByRole('button', { name: 'Notificaciones' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(NOTIFICATIONS_ERROR_MESSAGE)
  })

  it('el pie solo ofrece "Ver todas las notificaciones"', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }))

    const link = screen.getByRole('link', { name: 'Ver todas las notificaciones' })
    expect(link).toHaveAttribute('href', '/notifications')
    expect(screen.queryByRole('button', { name: 'Configuración' })).not.toBeInTheDocument()
  })

  it('se cierra con Escape y con un clic afuera', async () => {
    const user = userEvent.setup()
    renderMenu()
    const button = await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' })

    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    await user.click(screen.getByText('Afuera'))
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('marca como leída y navega al grupo al pulsar un aviso', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' }))

    await user.click(screen.getByRole('button', { name: /Aviso 1. No leída. Abrir/ }))

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Grupo 42')).toBeInTheDocument()
  })

  it('se recarga cuando se responde una solicitud en otra pantalla', async () => {
    renderMenu()
    await screen.findByRole('button', { name: 'Notificaciones, 1 sin leer' })

    act(() => window.dispatchEvent(new Event('friend-requests-changed')))

    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
  })
})
