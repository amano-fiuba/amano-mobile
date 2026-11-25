import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsPage, {
  ALL_FILTER,
  MARK_ALL_LABEL,
  NO_NOTIFICATIONS_MESSAGE,
  NOTIFICATIONS_LOAD_ERROR_MESSAGE,
  PREFERENCES_LABEL,
  UNREAD_FILTER,
} from './NotificationsPage'
import { MARK_READ_ERROR_MESSAGE } from '../utils/notificationTarget'

const { getNotifications, markRead, markAllRead } = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}))
vi.mock('../api/notificationsClient', () => ({ getNotifications, markRead, markAllRead }))
vi.mock('../components/NotificationPreferencesModal', () => ({
  default: ({ open }) => (open ? <div>Modal de preferencias</div> : null),
}))

const notice = (id, unread = true, target = { kind: 'GROUP', groupId: 42 }) => ({
  id,
  type: 'GROUP_EXPENSE',
  title: `Aviso ${id}`,
  message: 'Mensaje',
  createdAt: new Date(Date.now() - id * 60000).toISOString(),
  readAt: unread ? null : new Date().toISOString(),
  target,
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/notifications']}>
      <Routes>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/groups/:id" element={<p>Grupo destino</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  for (const mock of [getNotifications, markRead, markAllRead]) mock.mockReset()
  getNotifications.mockResolvedValue({
    ok: true,
    notifications: [notice(1), notice(2, false)],
    unreadCount: 1,
    nextCursor: null,
  })
  markRead.mockImplementation(async (id) => ({ ok: true, notification: notice(id, false) }))
  markAllRead.mockResolvedValue({ ok: true, updated: 1 })
})

describe('NotificationsPage (035 US2, US3, US4)', () => {
  it('carga el historial con orden history y límite 20', async () => {
    renderPage()

    expect(await screen.findByText('Aviso 1')).toBeInTheDocument()
    expect(screen.getByText('Aviso 2')).toBeInTheDocument()
    expect(getNotifications).toHaveBeenCalledWith({ limit: 20, order: 'history', before: null })
    expect(screen.getByRole('button', { name: MARK_ALL_LABEL })).toBeEnabled()
  })

  it('el filtro No leídas muestra solo las no leídas', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('tab', { name: UNREAD_FILTER }))

    expect(screen.getByText('Aviso 1')).toBeInTheDocument()
    expect(screen.queryByText('Aviso 2')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: ALL_FILTER })).toHaveAttribute('aria-selected', 'false')
  })

  it('marcar una actualiza el contador y la fila', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: 'Marcar como leída: Aviso 1' }))

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1))
    expect(screen.getByRole('button', { name: MARK_ALL_LABEL })).toBeDisabled()
  })

  it('marcar todas deja el contador en cero sin recargar', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: MARK_ALL_LABEL }))

    await waitFor(() => expect(markAllRead).toHaveBeenCalled())
    expect(markRead).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: MARK_ALL_LABEL })).toBeDisabled()
  })

  it('muestra error con reintento y estado vacío', async () => {
    getNotifications.mockResolvedValueOnce({ ok: false, network: true })
    const { unmount } = renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(NOTIFICATIONS_LOAD_ERROR_MESSAGE)
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2))
    unmount()

    getNotifications.mockResolvedValue({ ok: true, notifications: [], unreadCount: 0, nextCursor: null })
    renderPage()
    expect(await screen.findByText(NO_NOTIFICATIONS_MESSAGE)).toBeInTheDocument()
  })

  it('los filtros se pueden usar con teclado (T042)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    const unreadTab = screen.getByRole('tab', { name: UNREAD_FILTER })
    expect(unreadTab).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(unreadTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Aviso 2')).not.toBeInTheDocument()
  })

  it('abre el modal de preferencias desde la bandeja', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: PREFERENCES_LABEL }))
    expect(await screen.findByText('Modal de preferencias')).toBeInTheDocument()
  })

  it('al pulsar una notificación marca y navega al destino (deep link)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: /Aviso 1. No leída. Abrir/ }))

    await waitFor(() => expect(markRead).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Grupo destino')).toBeInTheDocument()
  })

  it('si falla el marcado, avisa en español y no navega', async () => {
    markRead.mockResolvedValue({ ok: false, status: 500 })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: /Aviso 1. No leída. Abrir/ }))

    expect(await screen.findByTestId('snackbar')).toHaveTextContent(MARK_READ_ERROR_MESSAGE)
    expect(screen.queryByText('Grupo destino')).not.toBeInTheDocument()
  })

  it('carga más páginas con el cursor devuelto', async () => {
    getNotifications
      .mockResolvedValueOnce({ ok: true, notifications: [notice(1)], unreadCount: 1, nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ ok: true, notifications: [notice(3)], unreadCount: 1, nextCursor: null })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Aviso 1')

    await user.click(screen.getByRole('button', { name: 'Cargar más' }))

    expect(await screen.findByText('Aviso 3')).toBeInTheDocument()
    expect(getNotifications).toHaveBeenLastCalledWith({ limit: 20, order: 'history', before: 'cursor-2' })
  })
})
