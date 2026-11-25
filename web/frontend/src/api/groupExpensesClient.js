// API client for group expenses and their debts (specs/017-debt-states,
// contracts/group-expenses-api.md). Same convention as expenseClient: it never
// throws; 5xx and network failures are reported as { ok: false, network: true }.

import { apiUrl } from './apiBase'

export const GROUP_EXPENSE_NETWORK_ERROR_MESSAGE =
  'No se pudo registrar el gasto. Intentá nuevamente'
export const GROUP_EXPENSE_LOAD_ERROR_MESSAGE =
  'No se pudo cargar el gasto. Intentá nuevamente'

function safeFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(fields).filter(([, message]) => typeof message === 'string'),
  )
}

async function problemOf(response) {
  try {
    const body = await response.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

async function failure(response) {
  const problem = await problemOf(response)
  return {
    ok: false,
    status: response.status,
    detail: typeof problem.detail === 'string' ? problem.detail : '',
    fields: safeFields(problem.properties?.fields),
    code: problem.properties?.code ?? null,
  }
}

/**
 * POST /api/groups/{id}/expenses. Returns { ok: true, expense, created }
 * (created = 201, false on an idempotent replay with 200), { ok: false, status,
 * detail, fields, code } on 4xx, or { ok: false, network: true }.
 */
export async function createGroupExpense(groupId, payload, idempotencyKey) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/expenses`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, expense: await response.json(), created: response.status === 201 }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/groups/{id}/expenses/{expenseId}: { ok: true, expense } or a failure as above. */
export async function getGroupExpense(groupId, expenseId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/expenses/${expenseId}`), {
      method: 'GET',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, expense: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}

export const GROUP_EXPENSE_UPDATE_ERROR_MESSAGE =
  'No se pudo guardar el gasto. Intentá nuevamente'
export const GROUP_EXPENSE_DELETE_ERROR_MESSAGE =
  'No se pudo eliminar el gasto. Intentá nuevamente'

// 5xx are "network" failures, except 503: for PATCH it is the missing exchange
// quote and carries the server's message in voseo (022 D8).
function isNetworkFailure(response) {
  return response.status >= 500 && response.status !== 503
}

/**
 * PATCH /api/groups/{id}/expenses/{expenseId} (022 T077, personal expenses):
 * `fields` holds only what changes (amount, currency, date, description).
 * Returns { ok: true, expense }, { ok: false, status, detail, fields, code }
 * for 4xx and 503, or { ok: false, network: true }.
 */
export async function updateGroupExpense(groupId, expenseId, fields) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/expenses/${expenseId}`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    if (response.ok) {
      return { ok: true, expense: await response.json() }
    }
    if (isNetworkFailure(response)) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * DELETE /api/groups/{id}/expenses/{expenseId} (022 T077): { ok: true } on 204,
 * a failure as above on 4xx (409 with debts, 403, 404), or { network: true }.
 */
export async function deleteGroupExpense(groupId, expenseId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/expenses/${expenseId}`), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}

export const GROUP_DEBTS_LOAD_ERROR_MESSAGE =
  'No se pudo cargar esta información. Intentá nuevamente'

async function getJson(url) {
  try {
    const response = await fetch(apiUrl(url), { method: 'GET', credentials: 'include' })
    if (response.ok) {
      return { ok: true, data: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/groups/{id}/debts/pending (022 T043): the caller's open debts → { ok, data: [...] }. */
export function getPendingDebts(groupId) {
  return getJson(`/api/groups/${groupId}/debts/pending`)
}

/**
 * 030: POST /api/groups/{id}/debts/{debtId}/whistle — the creditor's manual notice.
 * Returns { ok: true, data } on 201; { ok: false, status, detail, fields, code,
 * retryAfterSeconds } on 4xx and on 503 (the server's own "no se pudo enviar"
 * message); { ok: false, network: true } on other 5xx or a network failure.
 * retryAfterSeconds (429) comes from properties.retryAfterSeconds or, when absent,
 * from the Retry-After header.
 */
export async function whistleDebt(groupId, debtId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/debts/${debtId}/whistle`), {
      method: 'POST',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, data: await response.json() }
    }
    if (response.status >= 500 && response.status !== 503) {
      return { ok: false, network: true }
    }
    const problem = await problemOf(response)
    const header = Number(response.headers?.get?.('Retry-After'))
    const fromBody = Number(problem.properties?.retryAfterSeconds)
    let retryAfterSeconds = null
    if (Number.isFinite(fromBody) && fromBody > 0) retryAfterSeconds = fromBody
    else if (Number.isFinite(header) && header > 0) retryAfterSeconds = header
    return {
      ok: false,
      status: response.status,
      detail: typeof problem.detail === 'string' ? problem.detail : '',
      fields: safeFields(problem.properties?.fields),
      code: problem.properties?.code ?? null,
      retryAfterSeconds,
    }
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/groups/{id}/balances (022 T012): balances by currency → { ok, data }. */
export function getGroupBalances(groupId) {
  return getJson(`/api/groups/${groupId}/balances`)
}

/** GET /api/groups/{id}/settlement-proposal (022 T027, read-only) → { ok, data }. */
export function getSettlementProposal(groupId) {
  return getJson(`/api/groups/${groupId}/settlement-proposal`)
}


/**
 * 027 US4: POST /api/users/me/friends/{friendId}/expenses, an expense shared with
 * a friend. Same results as createGroupExpense; a stranger is a 404.
 */
export async function createFriendExpense(friendId, payload, idempotencyKey) {
  try {
    const response = await fetch(apiUrl(`/api/users/me/friends/${friendId}/expenses`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, expense: await response.json(), created: response.status === 201 }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failure(response)
  } catch {
    return { ok: false, network: true }
  }
}
