import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NOTIFICATIONS_API_BASE,
  getNotifications,
  getPreferences,
  markAllRead,
  markRead,
  updatePreferences,
} from './notificationsClient'

function response({ ok = true, status = 200, body = {} } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

afterEach(() => vi.unstubAllGlobals())

describe('notificationsClient (035)', () => {
  it('pide el listado con cookie y devuelve notificaciones y contador', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      body: {
        notifications: [{ id: 3, type: 'GROUP_EXPENSE', title: 'Gasto', message: 'Mensaje', target: { kind: 'GROUP', groupId: 5 } }],
        unreadCount: 2,
        nextCursor: 'abc',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getNotifications({ limit: 5, order: 'unread-first' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${NOTIFICATIONS_API_BASE}?limit=5&order=unread-first`,
      { credentials: 'include' },
    )
    expect(result).toMatchObject({
      ok: true,
      unreadCount: 2,
      nextCursor: 'abc',
      notifications: [{ id: 3, type: 'GROUP_EXPENSE', target: { kind: 'GROUP', groupId: 5 } }],
    })
  })

  it('marca una como leída con PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ body: { id: 3, readAt: '2026-11-23T12:00:00Z' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await markRead(3)

    expect(fetchMock).toHaveBeenCalledWith(`${NOTIFICATIONS_API_BASE}/3/read`, {
      credentials: 'include', method: 'PATCH',
    })
    expect(result.ok).toBe(true)
    expect(result.notification.readAt).toBe('2026-11-23T12:00:00Z')
  })

  it('marca todas como leídas y lee el número actualizado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ body: { updated: 4 } }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await markAllRead()).toEqual({ ok: true, updated: 4 })
    expect(fetchMock).toHaveBeenCalledWith(`${NOTIFICATIONS_API_BASE}/read-all`, {
      credentials: 'include', method: 'PATCH',
    })
  })

  it('lee y actualiza preferencias por la persona de la sesión', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ body: { channels: { inApp: true, email: true } } }))
      .mockResolvedValueOnce(response({ body: { channels: { inApp: true, email: false } } }))
    vi.stubGlobal('fetch', fetchMock)

    await getPreferences()
    await updatePreferences({ channels: { inApp: true, email: false }, eventTypes: {} })

    expect(fetchMock).toHaveBeenNthCalledWith(1, `${NOTIFICATIONS_API_BASE}/preferences`, {
      credentials: 'include',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${NOTIFICATIONS_API_BASE}/preferences`, {
      credentials: 'include',
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: { inApp: true, email: false }, eventTypes: {} }),
    })
  })

  it('devuelve 404/400 y campos de validación sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ok: false, status: 404, body: { detail: 'No se encontró la notificación' },
    })))

    const notFound = await markRead(99)
    expect(notFound).toMatchObject({ ok: false, status: 404, detail: 'No se encontró la notificación' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ok: false, status: 400, body: { properties: { fields: { 'channels.email': 'El campo es obligatorio' } } },
    })))
    const invalid = await updatePreferences({})
    expect(invalid.fields).toEqual({ 'channels.email': 'El campo es obligatorio' })
  })

  it('trata 401, 5xx y errores de red como fallos sin lanzar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 401 })))
    expect(await getNotifications()).toMatchObject({ ok: false, status: 401 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: false, status: 503 })))
    expect(await markAllRead()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
    expect(await getPreferences()).toEqual({ ok: false, network: true })
  })
})
