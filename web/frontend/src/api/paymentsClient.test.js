import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PAYMENT_NETWORK_ERROR_MESSAGE,
  confirmPayment,
  getPaymentsPendingValidation,
  registerDebtPayment,
  registerPayment,
  rejectPayment,
} from './paymentsClient'

// 018 T043: client of POST /api/payments (plan.md §Contrato REST).

const PAYMENT = { id: 54, debtId: 31, amount: '1000.00', debt: { status: 'PARTIALLY_PAID' } }
const PAYLOAD = { debtId: 31, amount: '1000.00', date: '2026-11-05' }

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registerPayment (018)', () => {
  it('201 devuelve el pago creado y envía la clave, el cuerpo y la cookie', async () => {
    vi.stubGlobal('fetch', respond(201, PAYMENT))

    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({ ok: true, payment: PAYMENT, created: true })
    expect(fetch).toHaveBeenCalledWith('/api/payments', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' },
      body: JSON.stringify(PAYLOAD),
    })
  })

  it('200 es un reenvío idempotente', async () => {
    vi.stubGlobal('fetch', respond(200, PAYMENT))
    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({ ok: true, payment: PAYMENT, created: false })
  })

  it('400 trae los mensajes por campo y descarta los que no son texto', async () => {
    vi.stubGlobal('fetch', respond(400, {
      detail: 'Datos inválidos',
      properties: { fields: { amount: 'El pago no puede superar el saldo de $ 2.333,33', date: 3 } },
    }))
    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({
      ok: false,
      status: 400,
      detail: 'Datos inválidos',
      fields: { amount: 'El pago no puede superar el saldo de $ 2.333,33' },
      code: null,
    })
  })

  it.each([
    [403, { detail: 'Solo quien debe, quien cobra o un administrador pueden registrar este pago' }, null],
    [404, { detail: 'No existe la deuda solicitada o no sos miembro del grupo' }, null],
    [409, { detail: 'La deuda ya está pagada', properties: { code: 'DEBT_ALREADY_PAID' } }, 'DEBT_ALREADY_PAID'],
    [422, { detail: 'Clave reutilizada', properties: { code: 'IDEMPOTENCY_KEY_REUSED' } }, 'IDEMPOTENCY_KEY_REUSED'],
  ])('%i devuelve el estado, el detalle y el código', async (status, body, code) => {
    vi.stubGlobal('fetch', respond(status, body))
    const result = await registerPayment(PAYLOAD, 'key-1')
    expect(result).toMatchObject({ ok: false, status, detail: body.detail, fields: {}, code })
  })

  it('401 o un cuerpo ilegible no rompen el cliente', async () => {
    vi.stubGlobal('fetch', respond(401, new Error('not json')))
    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({
      ok: false, status: 401, detail: '', fields: {}, code: null,
    })
    vi.stubGlobal('fetch', respond(400, null))
    expect(await registerPayment(PAYLOAD, 'key-1')).toMatchObject({ ok: false, status: 400, fields: {} })
    vi.stubGlobal('fetch', respond(400, { properties: { fields: ['amount'] } }))
    expect(await registerPayment(PAYLOAD, 'key-1')).toMatchObject({ fields: {} })
  })

  it('5xx y errores de red se informan como red', async () => {
    vi.stubGlobal('fetch', respond(503, {}))
    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await registerPayment(PAYLOAD, 'key-1')).toEqual({ ok: false, network: true })
    expect(PAYMENT_NETWORK_ERROR_MESSAGE).toBe('No se pudo registrar el pago. Intentá nuevamente')
  })
})

describe('registerDebtPayment (022 T075/T082)', () => {
  const BODY = { amount: '1500.00', idempotencyKey: '11111111-1111-4111-8111-111111111111' }

  it('201 manda el monto elegido (parcial o total) y la clave en el cuerpo (no en un header) y devuelve el pago', async () => {
    const payment = { paymentId: 91, status: 'REPORTED', debtStatusAfter: 'PAYMENT_REPORTED' }
    vi.stubGlobal('fetch', respond(201, payment))

    expect(await registerDebtPayment(3, 31, BODY)).toEqual({ ok: true, payment, created: true })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('/api/groups/3/debts/31/payments')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual(BODY)
  })

  it('200 es un reenvío idempotente', async () => {
    vi.stubGlobal('fetch', respond(200, { paymentId: 91 }))
    expect((await registerDebtPayment(3, 31, BODY)).created).toBe(false)
  })

  it('400, 403, 404, 409 y 422 devuelven estado, detalle, campos y código', async () => {
    vi.stubGlobal('fetch', respond(400, {
      detail: 'x',
      properties: { fields: { amount: 'El monto del pago excede la deuda pendiente', otro: 3 } },
    }))
    expect(await registerDebtPayment(3, 31, BODY)).toEqual({
      ok: false,
      status: 400,
      detail: 'x',
      fields: { amount: 'El monto del pago excede la deuda pendiente' },
      code: null,
    })
    vi.stubGlobal('fetch', respond(409, {
      detail: 'Esta deuda ya tiene un pago esperando validación: esperá a que un administrador lo decida',
      properties: { code: 'DEBT_ALREADY_HAS_PAYMENT' },
    }))
    expect(await registerDebtPayment(3, 31, BODY)).toMatchObject({
      status: 409,
      detail: 'Esta deuda ya tiene un pago esperando validación: esperá a que un administrador lo decida',
      code: 'DEBT_ALREADY_HAS_PAYMENT',
    })
    for (const status of [403, 404, 422]) {
      vi.stubGlobal('fetch', respond(status, { detail: `d${status}` }))
      expect(await registerDebtPayment(3, 31, BODY)).toMatchObject({ ok: false, status, detail: `d${status}` })
    }
  })

  it('503 conserva el mensaje; otros 5xx, cuerpos ilegibles y la red se tratan con cuidado', async () => {
    vi.stubGlobal('fetch', respond(503, { detail: 'Servicio no disponible' }))
    expect(await registerDebtPayment(3, 31, BODY)).toMatchObject({ ok: false, status: 503, detail: 'Servicio no disponible' })
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await registerDebtPayment(3, 31, BODY)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', respond(403, new Error('json roto')))
    expect(await registerDebtPayment(3, 31, BODY)).toMatchObject({ status: 403, detail: '', fields: {} })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await registerDebtPayment(3, 31, BODY)).toEqual({ ok: false, network: true })
  })
})

describe('confirmPayment / rejectPayment (022 T075)', () => {
  it.each([
    ['confirm', confirmPayment, 'CONFIRMED'],
    ['reject', rejectPayment, 'REJECTED'],
  ])('%s hace POST sin cuerpo y devuelve el resultado', async (action, call, status) => {
    vi.stubGlobal('fetch', respond(200, { paymentId: 91, status }))

    expect(await call(3, 91)).toEqual({ ok: true, payment: { paymentId: 91, status } })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`/api/groups/3/payments/91/${action}`)
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(init.body).toBeUndefined()
  })

  it('403, 404 y 409 devuelven el mensaje del servidor y la red se trata como red', async () => {
    vi.stubGlobal('fetch', respond(409, {
      detail: 'Este pago no está pendiente de validación',
      properties: { code: 'PAYMENT_NOT_DECIDABLE' },
    }))
    expect(await confirmPayment(3, 91)).toMatchObject({
      ok: false, status: 409, detail: 'Este pago no está pendiente de validación', code: 'PAYMENT_NOT_DECIDABLE',
    })
    vi.stubGlobal('fetch', respond(403, { detail: 'Solo los administradores pueden rechazar pagos' }))
    expect((await rejectPayment(3, 91)).status).toBe(403)
    vi.stubGlobal('fetch', respond(502, {}))
    expect(await confirmPayment(3, 91)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await rejectPayment(3, 91)).toEqual({ ok: false, network: true })
  })
})

describe('getPaymentsPendingValidation (022 T075)', () => {
  it('200 devuelve la lista (vacía si el cuerpo no es una lista)', async () => {
    vi.stubGlobal('fetch', respond(200, [{ paymentId: 91 }]))
    expect(await getPaymentsPendingValidation(3)).toEqual({ ok: true, payments: [{ paymentId: 91 }] })
    expect(fetch.mock.calls[0][0]).toBe('/api/groups/3/payments/pending-validation')
    vi.stubGlobal('fetch', respond(200, { x: 1 }))
    expect(await getPaymentsPendingValidation(3)).toEqual({ ok: true, payments: [] })
  })

  it('403, 404, 5xx y la red devuelven el fallo correspondiente', async () => {
    vi.stubGlobal('fetch', respond(403, { detail: 'Solo los administradores pueden ver los pagos por validar' }))
    expect(await getPaymentsPendingValidation(3)).toMatchObject({ ok: false, status: 403 })
    vi.stubGlobal('fetch', respond(404, {}))
    expect((await getPaymentsPendingValidation(3)).status).toBe(404)
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await getPaymentsPendingValidation(3)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getPaymentsPendingValidation(3)).toEqual({ ok: false, network: true })
  })
})

