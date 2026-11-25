// API client for payments of group debts (specs/018-register-payment, plan.md
// §Contrato REST). Same convention as groupExpensesClient (017): it never
// throws; 5xx and network failures are reported as { ok: false, network: true }.

import { apiUrl } from './apiBase'

export const PAYMENT_NETWORK_ERROR_MESSAGE = 'No se pudo registrar el pago. Intentá nuevamente'

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

/**
 * POST /api/payments. Returns { ok: true, payment, created } (created = 201,
 * false on an idempotent replay with 200), { ok: false, status, detail, fields,
 * code } on 4xx, or { ok: false, network: true }.
 */
export async function registerPayment(payload, idempotencyKey) {
  try {
    const response = await fetch(apiUrl('/api/payments'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, payment: await response.json(), created: response.status === 201 }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await problemOf(response)
    return {
      ok: false,
      status: response.status,
      detail: typeof problem.detail === 'string' ? problem.detail : '',
      fields: safeFields(problem.properties?.fields),
      code: problem.properties?.code ?? null,
    }
  } catch {
    return { ok: false, network: true }
  }
}

export const DEBT_PAYMENT_NETWORK_ERROR_MESSAGE = 'No se pudo registrar el pago. Intentá nuevamente'
export const PAYMENT_DECISION_NETWORK_ERROR_MESSAGE =
  'No se pudo guardar tu decisión. Intentá nuevamente'
export const PENDING_PAYMENTS_LOAD_ERROR_MESSAGE =
  'No se pudieron cargar los pagos por validar. Intentá nuevamente'

async function failureOf(response) {
  const problem = await problemOf(response)
  return {
    ok: false,
    status: response.status,
    detail: typeof problem.detail === 'string' ? problem.detail : '',
    fields: safeFields(problem.properties?.fields),
    code: problem.properties?.code ?? null,
  }
}

// 5xx are "network" failures, except 503, which keeps the server's message.
const isNetworkFailure = (response) => response.status >= 500 && response.status !== 503

/**
 * POST /api/groups/{groupId}/debts/{debtId}/payments (022 T040/T080): registers a
 * partial or total payment of a debt. The amount (0 < amount <= outstanding) and
 * the idempotency key travel in the body. Returns { ok: true, payment, created }
 * (201 / 200 on replay), { ok: false, status, detail, fields, code } or
 * { ok: false, network: true }.
 */
export async function registerDebtPayment(groupId, debtId, { amount, idempotencyKey }) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/debts/${debtId}/payments`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, idempotencyKey }),
    })
    if (response.ok) {
      return { ok: true, payment: await response.json(), created: response.status === 201 }
    }
    if (isNetworkFailure(response)) {
      return { ok: false, network: true }
    }
    return failureOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

async function decide(groupId, paymentId, action) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/payments/${paymentId}/${action}`), {
      method: 'POST',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, payment: await response.json() }
    }
    if (isNetworkFailure(response)) {
      return { ok: false, network: true }
    }
    return failureOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** POST /api/groups/{g}/payments/{p}/confirm (admins): { ok, payment } or a failure (403/404/409). */
export function confirmPayment(groupId, paymentId) {
  return decide(groupId, paymentId, 'confirm')
}

/** POST /api/groups/{g}/payments/{p}/reject (admins): { ok, payment } or a failure (403/404/409). */
export function rejectPayment(groupId, paymentId) {
  return decide(groupId, paymentId, 'reject')
}

/** GET /api/groups/{g}/payments/pending-validation (admins): { ok, payments } or a failure. */
export async function getPaymentsPendingValidation(groupId) {
  try {
    const response = await fetch(apiUrl(`/api/groups/${groupId}/payments/pending-validation`), {
      method: 'GET',
      credentials: 'include',
    })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, payments: Array.isArray(body) ? body : [] }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    return failureOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

