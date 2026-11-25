// API client for feature 035 (contracts/notifications-api.md). Same convention
// as the other api/*.js clients: it never throws and always returns
// { ok: true, ... } or { ok: false, ... }.
import { problemOf, safeFields } from './problemDetail'
import { apiUrl } from './apiBase'

export const NOTIFICATIONS_API_BASE = '/api/v1/notifications'

export const NOTIFICATIONS_ERROR_MESSAGE =
  'No pudimos cargar tus notificaciones. Intentá nuevamente'
export const NOTIFICATIONS_ACTION_ERROR_MESSAGE =
  'No pudimos actualizar la notificación. Intentá nuevamente'
export const PREFERENCES_SAVE_ERROR_MESSAGE =
  'No pudimos guardar tus preferencias de notificación. Intentá nuevamente'

async function request(path, options = {}) {
  try {
    const response = await fetch(apiUrl(`${NOTIFICATIONS_API_BASE}${path}`), {
      credentials: 'include',
      ...options,
    })
    if (response.ok) {
      return { ok: true, body: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await problemOf(response)
    return {
      ok: false,
      status: response.status,
      detail: problem.detail ?? '',
      fields: safeFields(problem.properties?.fields),
    }
  } catch {
    return { ok: false, network: true }
  }
}

function notificationOf(value) {
  return {
    id: value?.id,
    type: value?.type ?? 'NONE',
    title: value?.title ?? '',
    message: value?.message ?? '',
    createdAt: value?.createdAt ?? null,
    readAt: value?.readAt ?? null,
    target: value?.target ?? { kind: 'NONE' },
  }
}

/** GET /api/v1/notifications (history or unread-first for the popover). */
export async function getNotifications({ limit, before, order } = {}) {
  const params = new URLSearchParams()
  if (limit !== undefined && limit !== null) params.set('limit', String(limit))
  if (before) params.set('before', before)
  if (order) params.set('order', order)
  const query = params.size ? `?${params}` : ''
  const result = await request(query)
  if (!result.ok) return result
  const body = result.body ?? {}
  return {
    ok: true,
    notifications: Array.isArray(body.notifications) ? body.notifications.map(notificationOf) : [],
    unreadCount: Number.isInteger(body.unreadCount) ? body.unreadCount : 0,
    nextCursor: body.nextCursor ?? null,
  }
}

/** PATCH /api/v1/notifications/{id}/read (idempotent). */
export async function markRead(id) {
  const result = await request(`/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
  if (!result.ok) return result
  return { ok: true, notification: notificationOf(result.body) }
}

/** PATCH /api/v1/notifications/read-all. */
export async function markAllRead() {
  const result = await request('/read-all', { method: 'PATCH' })
  if (!result.ok) return result
  return { ok: true, updated: Number.isInteger(result.body?.updated) ? result.body.updated : 0 }
}

/** GET /api/v1/notifications/preferences (creates the defaults when missing). */
export async function getPreferences() {
  const result = await request('/preferences')
  if (!result.ok) return result
  return { ok: true, preferences: result.body ?? {} }
}

/** PUT /api/v1/notifications/preferences. */
export async function updatePreferences(payload) {
  const result = await request('/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!result.ok) return result
  return { ok: true, preferences: result.body ?? {} }
}
