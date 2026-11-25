import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import NotificationRow from './NotificationRow'
import { notificationDate } from '../utils/notificationDate'

const unread = {
  id: 3,
  title: 'Gasto nuevo',
  message: 'Ana registró un gasto',
  createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  readAt: null,
}
const read = { ...unread, id: 4, title: 'Pago recibido', readAt: unread.createdAt }

describe('NotificationRow (035 FR-002, FR-009, FR-011)', () => {
  it('distingue leídas de no leídas con texto y estado accesible', () => {
    render(
      <ul>
        <NotificationRow notification={unread} onOpen={vi.fn()} onMarkRead={vi.fn()} />
        <NotificationRow notification={read} onOpen={vi.fn()} onMarkRead={vi.fn()} />
      </ul>,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveAttribute('data-read', 'unread')
    expect(rows[1]).toHaveAttribute('data-read', 'read')
    expect(screen.getByText(/No leída/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gasto nuevo. No leída. Abrir/ })).toBeInTheDocument()
  })

  it('ofrece marcar como leída solo en las no leídas', async () => {
    const onMarkRead = vi.fn()
    const user = userEvent.setup()
    render(
      <ul>
        <NotificationRow notification={unread} onOpen={vi.fn()} onMarkRead={onMarkRead} />
        <NotificationRow notification={read} onOpen={vi.fn()} onMarkRead={onMarkRead} />
      </ul>,
    )

    expect(screen.getAllByRole('button', { name: /Marcar como leída/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Marcar como leída: Gasto nuevo' }))
    expect(onMarkRead).toHaveBeenCalledWith(3)
  })

  it('puede ocultar la acción de marcar como leída (popover)', () => {
    render(
      <ul>
        <NotificationRow notification={unread} onOpen={vi.fn()} showMarkRead={false} />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: /Marcar como leída/ })).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveAttribute('data-read', 'unread')
  })

  it('abre la notificación al pulsar el cuerpo', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    render(<ul><NotificationRow notification={read} onOpen={onOpen} onMarkRead={vi.fn()} /></ul>)

    await user.click(screen.getByRole('button', { name: /Pago recibido. Leída. Abrir/ }))
    expect(onOpen).toHaveBeenCalledWith(read)
  })

  it('formatea fechas relativas y absolutas', () => {
    const now = Date.parse('2026-11-23T12:00:00Z')
    expect(notificationDate('2026-11-23T11:59:30Z', now)).toBe('recién')
    expect(notificationDate('2026-11-23T11:00:00Z', now)).toBe('hace 1 h')
    expect(notificationDate('2026-11-22T10:00:00Z', now)).toMatch(/22/)
    expect(notificationDate(undefined, now)).toBe('')
  })
})
