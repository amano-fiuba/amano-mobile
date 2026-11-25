// API client for the groups endpoints (US1, contracts/api-contracts.md).
// Convention identical to authClient/expenseClient: { ok: true, ... } on 2xx,
// { ok: false, status, fields, detail } on 4xx, { ok: false, network: true }
// on 5xx or network failures.

import { apiUrl } from './apiBase'

const CANNOT_CREATE_MESSAGE = 'No se pudo crear el grupo. Intenta nuevamente'

function safeFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(fields)
      .map(([key, message]) => [key, typeof message === 'object' && message !== null ? (message && typeof message === 'string' ? message : JSON.stringify(message)) : message])
      .filter(([, message]) => typeof message === 'string'),
  )
}

function fieldsFrom(detail) {
  return { member: detail || CANNOT_CREATE_MESSAGE }
}

/**
 * POST /api/groups. Returns { ok: true, group } on 201, { ok: false, status,
 * fields, detail } on 4xx and { ok: false, network: true } on 5xx/network.
 */
export async function createGroup(payload) {
  try {
    const response = await fetch(apiUrl('/api/groups'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const fields = body?.properties?.fields ? safeFields(body.properties.fields) : {}
      return {
        ok: false,
        status: response.status,
        fields: Object.keys(fields).length
          ? { ...fields }
          : { member: body?.detail || CANNOT_CREATE_MESSAGE },
        detail: body?.detail,
      }
    }
    return { ok: true, group: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/groups: the caller's active groups. */
export async function listGroups() {
  try {
    const response = await fetch(apiUrl('/api/groups'), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, fields: fieldsFrom(body?.detail) }
    }
    const groups = await response.json()
    return { ok: true, groups: Array.isArray(groups) ? groups : [] }
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/groups/{id}: the group detail for the caller. */
export async function getGroup(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}`), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, fields: fieldsFrom(body?.detail) }
    }
    return { ok: true, group: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * PUT /api/groups/{id}: partial update of group settings (name, description,
 * permission casillas). Authz is server-side (GroupPermissionChecker); the
 * client only renders reasons.
 */
export async function updateGroup(groupId, payload) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const fields = body?.properties?.fields ? safeFields(body.properties.fields) : {}
      return {
        ok: false,
        status: response.status,
        fields: Object.keys(fields).length ? { ...fields } : {},
        detail: body?.detail || CANNOT_CREATE_MESSAGE,
      }
    }
    return { ok: true, group: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * GET /api/groups/{id}/reminder-settings: admin-only reminder configuration
 * (025 US2). Returns { ok, settings } or { ok: false, status, detail }.
 */
export async function getReminderSettings(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/reminder-settings`), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail, fields: {} }
    }
    return { ok: true, settings: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * PUT /api/groups/{id}/reminder-settings: partial update, only the fields
 * present are changed (025 US2/US4).
 */
export async function updateReminderSettings(groupId, payload) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/reminder-settings`), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const fields = body?.properties?.fields ? safeFields(body.properties.fields) : {}
      return {
        ok: false,
        status: response.status,
        fields: Object.keys(fields).length ? { ...fields } : {},
        detail: body?.detail,
      }
    }
    return { ok: true, settings: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * GET /api/groups/{id}/candidates?q=: only the caller's friends (server-side
 * restriction; never the whole user base).
 */
export async function searchCandidates(groupId, query) {
  try {
    const response = await fetch(
      apiUrl(`/api/groups/${groupId}/candidates?q=${encodeURIComponent(query)}`),
      { method: 'GET', credentials: 'include' },
    )
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail, fields: fieldsFrom(body?.detail) }
    }
    const data = await response.json()
    return { ok: true, content: Array.isArray(data.content) ? data.content : [] }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * POST /api/groups/{id}/members: registered friend (identifier = email) or
 * simulated profile (identifier + name). Reasons (ya es miembro, no es amigo,
 * casilla de invitación) come in `detail` for the UI.
 */
export async function addMember(groupId, payload) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/members`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const fields = body?.properties?.fields ? safeFields(body.properties.fields) : {}
      return {
        ok: false,
        status: response.status,
        fields,
        detail: body?.detail,
      }
    }
    return { ok: true, member: (await response.json()).member }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * GET /api/groups/{id}/activity: paginated descending history (todos los
 * miembros activos). `eventTypes` (arreglo) se envía como `eventType=A,B`
 * (specs/014-group-activity-history, contracts/activity-api.md); `eventType`
 * (un solo tipo) se mantiene por compatibilidad con 010.
 */
export async function getActivity(groupId, { page = 1, size = 20, eventType, eventTypes } = {}) {
  try {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    const types = Array.isArray(eventTypes) && eventTypes.length ? eventTypes.join(',') : eventType
    if (types) {
      params.set('eventType', types)
    }
    const response = await fetch(apiUrl(`/api/groups/${groupId}/activity?${params.toString()}`), {
      method: 'GET',
      credentials: 'include',
    })
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail }
    }
    return { ok: true, ...(await response.json()) }
  } catch {
    return { ok: false, network: true }
  }
}

/** DELETE /api/groups/{id}/members/{userId}: soft baja by an ADMIN (US4). */
export async function removeMember(groupId, userId) {
  return deletionRequest(`/api/groups/${groupId}/members/${userId}`)
}

/**
 * DELETE /api/groups/{id}/simulated-profiles/{profileId}: physical DELETE of
 * the row, by an ADMIN or a MEMBER with the casilla active (US4).
 */
export async function removeSimulatedProfile(groupId, profileId) {
  return deletionRequest(`/api/groups/${groupId}/simulated-profiles/${profileId}`)
}

/**
 * POST /api/groups/{id}/leave: the caller leaves the group (US5). The server
 * decides the last-admin and pending-balance motives and answers with a
 * user-facing message.
 */
export async function leaveGroup(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/leave`), {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, fields: {}, detail: body?.detail }
    }
    return { ok: true, ...(await response.json()) }
  } catch {
    return { ok: false, network: true }
  }
}

async function deletionRequest(url) {
  try {
    const response = await fetch(apiUrl(url), { method: 'DELETE', credentials: 'include' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, fields: {}, detail: body?.detail }
    }
    return { ok: true, ...(await response.json()) }
  } catch {
    return { ok: false, network: true }
  }
}

/** POST …/admin: assign the ADMIN role (US10). */
export async function grantAdminRole(groupId, userId) {
  return jsonRequest(`/api/groups/${groupId}/members/${userId}/admin`, 'POST')
}

/** DELETE …/admin: revoke the ADMIN role (US10). */
export async function revokeAdminRole(groupId, userId) {
  return jsonRequest(`/api/groups/${groupId}/members/${userId}/admin`, 'DELETE')
}

/** GET /api/groups/{id}/members: active registered members + simulated profiles (US6). */
export async function getMembers(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/members`), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail }
    }
    const body = await response.json()
    return {
      ok: true,
      members: Array.isArray(body) ? body : [],
    }
  } catch {
    return { ok: false, network: true }
  }
}

/** POST /api/groups/{id}/photo: multipart upload/replacement (US8). */
export async function uploadGroupPhoto(groupId, file) {
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(apiUrl(`/api/groups/${groupId}/photo`), {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail }
    }
    return { ok: true, ...(await response.json()) }
  } catch {
    return { ok: false, network: true }
  }
}

/** DELETE /api/groups/{id}/photo: back to the default photo. */
export async function deleteGroupPhoto(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/photo`), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail }
    }
    return { ok: true }
  } catch {
    return { ok: false, network: true }
  }
}

async function jsonRequest(url, method) {
  try {
    const response = await fetch(apiUrl(url), { method, credentials: 'include' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, fields: {}, detail: body?.detail }
    }
    return { ok: true, ...(await response.json()) }
  } catch {
    return { ok: false, network: true }
  }
}

// 022 T069: read-only quote of `currency` into the group's currency on `date`
// (aaaa-mm-dd). Resolves { ok, quote } or { ok: false, status, detail } / { network }.
export async function getExchangeQuote(groupId, currency, date) {
  try {
    const params = new URLSearchParams({ currency, date })
    const response = await fetch(apiUrl(`/api/groups/${groupId}/exchange-quote?${params.toString()}`), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail }
    }
    return { ok: true, quote: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

export const GROUPS_NETWORK_ERROR_MESSAGE =
  'No se pudo conectar con el servidor. Intenta nuevamente'

/**
 * GET /api/groups/{id}/recurring-expenses (028): the recurring series of the
 * group, newest first. Any active member can list them.
 */
export async function listGroupRecurringExpenses(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/recurring-expenses`), {
      method: 'GET',
      credentials: 'include',
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return { ok: false, status: response.status, detail: body?.detail, fields: {} }
    }
    return { ok: true, series: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * PATCH /api/groups/{id}/recurring-expenses/{expenseId} (028): pause/resume or
 * change the frequency of a series. Only the fields present are changed.
 */
export async function updateGroupRecurringExpense(groupId, expenseId, payload) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/recurring-expenses/${expenseId}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const fields = body?.properties?.fields ? safeFields(body.properties.fields) : {}
      return {
        ok: false,
        status: response.status,
        fields: Object.keys(fields).length ? { ...fields } : {},
        detail: body?.detail,
      }
    }
    return { ok: true, series: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}
