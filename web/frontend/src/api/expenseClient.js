// API client for POST /api/expenses (T024; contracts/expenses-api.md). The
// idempotency key identifies one save operation and travels as a header; the
// device time zone is part of the payload (D1/D5). Amounts arrive canonical.

import { problemOf, safeFields } from './problemDetail'
import { apiUrl } from './apiBase'

export const EXPENSE_NETWORK_ERROR_MESSAGE =
  'No se pudo guardar el gasto. Intenta nuevamente'

/**
 * Returns { ok: true, expense } on 201/200, { ok: false, status, fields, detail }
 * on other 4xx, { ok: false, status: 422, reusedKey: true, detail } when the key
 * was reused with a different payload, and { ok: false, network: true } on 5xx
 * or network failures (same convention as authClient).
 */
export async function createExpense(payload, idempotencyKey) {
  try {
    const response = await fetch(apiUrl('/api/expenses'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, expense: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    let problem = {}
    try {
      problem = await response.json()
    } catch {
      problem = {}
    }
    if (response.status === 422) {
      return {
        ok: false,
        status: 422,
        reusedKey: true,
        detail: problem.detail ?? '',
        code: problem.properties?.code ?? null,
      }
    }
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

// Feature 009 (specs/009-pause-recurring-expense/contracts/recurring-expenses-api.md).
export const RECURRING_LOAD_ERROR_MESSAGE =
  'No se pudieron cargar tus gastos recurrentes. Intentá nuevamente'
export const RECURRING_UPDATE_ERROR_MESSAGE =
  'No se pudo actualizar el gasto recurrente. Intentá nuevamente'

/**
 * GET /api/expenses/recurring: { ok: true, expenses } on 200, { ok: false, status }
 * on 4xx (401 = no session) and { ok: false, network: true } on 5xx or network.
 */
export async function listRecurringExpenses() {
  try {
    const response = await fetch(apiUrl('/api/expenses/recurring'), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, expenses: Array.isArray(body) ? body : [] }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, network: true }
  }
}

export const RECENT_EXPENSES_ERROR_MESSAGE =
  'No se pudieron cargar tus últimos gastos. Intentá nuevamente'

/**
 * GET /api/expenses/recent (specs/015-main-screen): { ok: true, expenses } on
 * 200, { ok: false, status } on 4xx and { ok: false, network: true } on 5xx or
 * network failures.
 */
export async function listRecentExpenses() {
  try {
    const response = await fetch(apiUrl('/api/expenses/recent'), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, expenses: Array.isArray(body) ? body : [] }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * PATCH /api/expenses/{id}/status with { status } (ACTIVE | PAUSED | FINISHED):
 * { ok: true, expense } on 200, { ok: false, status, detail, code } on 4xx (400
 * invalid status, 401 no session, 404 not a series of the user, 409 finished) and
 * { ok: false, network: true } on 5xx or network.
 */
export async function updateRecurringExpenseStatus(id, status) {
  try {
    const response = await fetch(apiUrl(`/api/expenses/${encodeURIComponent(id)}/status`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (response.ok) {
      return { ok: true, expense: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await problemOf(response)
    return {
      ok: false,
      status: response.status,
      detail: problem.detail ?? '',
      code: problem.properties?.code ?? null,
    }
  } catch {
    return { ok: false, network: true }
  }
}

// Feature 031 (specs/031-buscar-en-actividad-personal/contracts/personal-expenses-search-api.md).
export const SEARCH_EXPENSES_ERROR_MESSAGE =
  'No pudimos cargar tu actividad. Intentá nuevamente'
export const EXPENSE_DETAIL_ERROR_MESSAGE =
  'No se pudo cargar el gasto. Intentá nuevamente'

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

/**
 * GET /api/expenses/search?q=&year=&month=&page=&size= (q omitted = no text
 * filter, year omitted = all years, month omitted = the whole year):
 * { ok: true, expenses, page, totalElements, totalPages } on 200,
 * { ok: false, status, fields } on 4xx (400 invalid criteria, 401 no session) and
 * { ok: false, network: true } on 5xx or network failures.
 */
export async function searchExpenses({ term, year, month, page, size } = {}) {
  const params = new URLSearchParams()
  const optional = { q: term, year, month, page, size }
  for (const [name, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined && value !== '') {
      params.set(name, String(value))
    }
  }
  try {
    const response = await fetch(apiUrl(`/api/expenses/search?${params}`), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      return {
        ok: true,
        expenses: Array.isArray(body?.expenses) ? body.expenses : [],
        page: positiveInteger(body?.page, 1) || 1,
        totalElements: positiveInteger(body?.totalElements, 0),
        totalPages: positiveInteger(body?.totalPages, 0),
      }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await problemOf(response)
    return { ok: false, status: response.status, fields: safeFields(problem.properties?.fields) }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * GET /api/expenses/years: { ok: true, years } (years with expenses, newest
 * first) on 200, { ok: false, status } on 4xx and { ok: false, network: true }
 * on 5xx or network failures.
 */
export async function listExpenseYears() {
  try {
    const response = await fetch(apiUrl('/api/expenses/years'), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      const years = Array.isArray(body?.years) ? body.years.filter(Number.isInteger) : []
      return { ok: true, years }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * GET /api/expenses/{id}: { ok: true, expense } on 200, { ok: false, status } on
 * 4xx (401 no session, 404 missing or foreign) and { ok: false, network: true }
 * on 5xx or network failures.
 */
export async function getExpense(id) {
  try {
    const response = await fetch(apiUrl(`/api/expenses/${encodeURIComponent(id)}`), {
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, expense: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, network: true }
  }
}

// Feature 032 (specs/032-estadisticas-gastos/contracts/expense-statistics-api.md).
export const STATISTICS_ERROR_MESSAGE =
  'No pudimos cargar tus estadísticas. Intentá nuevamente'

function breakdownOf(value) {
  return {
    total: typeof value?.total === 'string' ? value.total : '0.00',
    categories: Array.isArray(value?.categories) ? value.categories : [],
  }
}

/**
 * GET /api/expenses/statistics?year=&month=: { ok: true, statistics } on 200,
 * { ok: false, status } on 4xx (400 invalid period, 401 no session) and
 * { ok: false, network: true } on 5xx or network failures.
 */
export async function getExpenseStatistics({ year, month }) {
  const params = new URLSearchParams({ year: String(year), month: String(month) })
  try {
    const response = await fetch(apiUrl(`/api/expenses/statistics?${params}`), { credentials: 'include' })
    if (response.ok) {
      const body = (await response.json()) ?? {}
      return {
        ok: true,
        statistics: {
          currency: typeof body.currency === 'string' ? body.currency : 'ARS',
          total: typeof body.total === 'string' ? body.total : '0.00',
          excludedCount: Number.isInteger(body.excludedCount) ? body.excludedCount : 0,
          personal: breakdownOf(body.personal),
          group: breakdownOf(body.group),
          years: Array.isArray(body.years) ? body.years.filter(Number.isInteger) : [],
        },
      }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return { ok: false, status: response.status }
  } catch {
    return { ok: false, network: true }
  }
}
