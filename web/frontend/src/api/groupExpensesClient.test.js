import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GROUP_EXPENSE_LOAD_ERROR_MESSAGE,
  GROUP_EXPENSE_NETWORK_ERROR_MESSAGE,
  createFriendExpense,
  createGroupExpense,
  deleteGroupExpense,
  getGroupBalances,
  getGroupExpense,
  getPendingDebts,
  getSettlementProposal,
  updateGroupExpense,
  whistleDebt,
} from './groupExpensesClient'

// 017 T033: client of contracts/group-expenses-api.md.

const EXPENSE = { id: 12, groupId: 3, amount: '100.00', shares: [], debts: [] }

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)),
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGroupExpense (017)', () => {
  it('201 devuelve el gasto como creado y envía la clave, el cuerpo y la cookie', async () => {
    vi.stubGlobal('fetch', respond(201, EXPENSE))
    const payload = { amount: '100.00', currency: 'ARS' }

    expect(await createGroupExpense(3, payload, 'key-1')).toEqual({ ok: true, expense: EXPENSE, created: true })
    expect(fetch).toHaveBeenCalledWith('/api/groups/3/expenses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' },
      body: JSON.stringify(payload),
    })
  })

  it('200 (reenvío idempotente) devuelve el mismo gasto sin marcarlo como creado', async () => {
    vi.stubGlobal('fetch', respond(200, EXPENSE))
    expect(await createGroupExpense(3, {}, 'key-1')).toEqual({ ok: true, expense: EXPENSE, created: false })
  })

  it('400 devuelve el detalle y solo los mensajes de texto por campo', async () => {
    vi.stubGlobal('fetch', respond(400, {
      detail: 'Datos inválidos',
      properties: { fields: { amount: 'El monto no alcanza', participants: 'Hay participantes repetidos', bad: 3 } },
    }))
    expect(await createGroupExpense(3, {}, 'k')).toEqual({
      ok: false,
      status: 400,
      detail: 'Datos inválidos',
      fields: { amount: 'El monto no alcanza', participants: 'Hay participantes repetidos' },
      code: null,
    })
  })

  it('403, 404 y 422 devuelven el estado, el detalle y el código', async () => {
    vi.stubGlobal('fetch', respond(403, { detail: 'Solo podés registrar gastos pagados por vos' }))
    expect(await createGroupExpense(3, {}, 'k')).toMatchObject({
      ok: false, status: 403, detail: 'Solo podés registrar gastos pagados por vos', fields: {},
    })

    vi.stubGlobal('fetch', respond(404, { detail: 'No existe el grupo solicitado o no sos miembro' }))
    expect(await createGroupExpense(3, {}, 'k')).toMatchObject({ ok: false, status: 404 })

    vi.stubGlobal('fetch', respond(422, { detail: 'Clave reutilizada', properties: { code: 'IDEMPOTENCY_KEY_REUSED' } }))
    expect(await createGroupExpense(3, {}, 'k')).toMatchObject({
      ok: false, status: 422, code: 'IDEMPOTENCY_KEY_REUSED',
    })
  })

  it('401 y cuerpos ilegibles o con campos inválidos no rompen', async () => {
    vi.stubGlobal('fetch', respond(401, new Error('no json')))
    expect(await createGroupExpense(3, {}, 'k')).toEqual({
      ok: false, status: 401, detail: '', fields: {}, code: null,
    })

    vi.stubGlobal('fetch', respond(400, { detail: 5, properties: { fields: ['x'] } }))
    expect(await createGroupExpense(3, {}, 'k')).toMatchObject({ detail: '', fields: {} })

    vi.stubGlobal('fetch', respond(400, null))
    expect(await createGroupExpense(3, {}, 'k')).toMatchObject({ status: 400, detail: '', fields: {} })
  })

  it('5xx y errores de red se tratan como red', async () => {
    vi.stubGlobal('fetch', respond(503, {}))
    expect(await createGroupExpense(3, {}, 'k')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await createGroupExpense(3, {}, 'k')).toEqual({ ok: false, network: true })
  })

  it('expone los mensajes fijos', () => {
    expect(GROUP_EXPENSE_NETWORK_ERROR_MESSAGE).toBe('No se pudo registrar el gasto. Intentá nuevamente')
    expect(GROUP_EXPENSE_LOAD_ERROR_MESSAGE).toBe('No se pudo cargar el gasto. Intentá nuevamente')
  })
})

describe('getGroupExpense (017)', () => {
  it('200 devuelve el gasto y usa la cookie de sesión', async () => {
    vi.stubGlobal('fetch', respond(200, EXPENSE))
    expect(await getGroupExpense(3, 12)).toEqual({ ok: true, expense: EXPENSE })
    expect(fetch).toHaveBeenCalledWith('/api/groups/3/expenses/12', { method: 'GET', credentials: 'include' })
  })

  it('404 y 401 devuelven el estado', async () => {
    vi.stubGlobal('fetch', respond(404, { detail: 'No existe' }))
    expect(await getGroupExpense(3, 12)).toMatchObject({ ok: false, status: 404, detail: 'No existe' })

    vi.stubGlobal('fetch', respond(401, {}))
    expect(await getGroupExpense(3, 12)).toMatchObject({ ok: false, status: 401 })
  })

  it('5xx y errores de red se tratan como red', async () => {
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await getGroupExpense(3, 12)).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getGroupExpense(3, 12)).toEqual({ ok: false, network: true })
  })
})

describe('updateGroupExpense (022 T077)', () => {
  it('200 manda PATCH con solo los campos que cambian y devuelve el gasto', async () => {
    const fetchMock = respond(200, EXPENSE)
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateGroupExpense(3, 12, { amount: '150.00' })

    expect(result).toEqual({ ok: true, expense: EXPENSE })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/groups/3/expenses/12')
    expect(init).toMatchObject({ method: 'PATCH', credentials: 'include' })
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ amount: '150.00' }))
  })

  it('400, 403, 404 y 409 devuelven estado, detalle, código y campos', async () => {
    vi.stubGlobal('fetch', respond(409, {
      detail: 'No se permite editar un gasto que ya tiene participantes',
      properties: { code: 'EXPENSE_HAS_PARTICIPANTS' },
    }))
    expect(await updateGroupExpense(3, 12, { amount: '1.00' })).toEqual({
      ok: false,
      status: 409,
      detail: 'No se permite editar un gasto que ya tiene participantes',
      fields: {},
      code: 'EXPENSE_HAS_PARTICIPANTS',
    })

    vi.stubGlobal('fetch', respond(400, { detail: 'x', properties: { fields: { body: 'Enviá al menos un campo para editar' } } }))
    expect((await updateGroupExpense(3, 12, {})).fields).toEqual({ body: 'Enviá al menos un campo para editar' })

    vi.stubGlobal('fetch', respond(403, { detail: 'No podés editar este gasto' }))
    expect((await updateGroupExpense(3, 12, { amount: '1.00' })).status).toBe(403)
  })

  it('503 conserva el mensaje del servidor; otros 5xx y la red se tratan como red', async () => {
    vi.stubGlobal('fetch', respond(503, { detail: 'No se pudo obtener la cotización; reintente después' }))
    expect(await updateGroupExpense(3, 12, { currency: 'USD' })).toMatchObject({
      ok: false,
      status: 503,
      detail: 'No se pudo obtener la cotización; reintente después',
    })

    vi.stubGlobal('fetch', respond(500, {}))
    expect(await updateGroupExpense(3, 12, { amount: '1.00' })).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await updateGroupExpense(3, 12, { amount: '1.00' })).toEqual({ ok: false, network: true })
  })
})

describe('deleteGroupExpense (022 T077)', () => {
  it('204 devuelve ok y manda DELETE con la cookie', async () => {
    const fetchMock = respond(204, null)
    vi.stubGlobal('fetch', fetchMock)

    expect(await deleteGroupExpense(3, 12)).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/groups/3/expenses/12')
    expect(init).toMatchObject({ method: 'DELETE', credentials: 'include' })
  })

  it('409 y 403 devuelven el mensaje del servidor', async () => {
    vi.stubGlobal('fetch', respond(409, { detail: 'No se puede eliminar un gasto con deudas asociadas' }))
    expect(await deleteGroupExpense(3, 12)).toMatchObject({
      ok: false,
      status: 409,
      detail: 'No se puede eliminar un gasto con deudas asociadas',
    })
    vi.stubGlobal('fetch', respond(403, { detail: 'No podés eliminar este gasto' }))
    expect((await deleteGroupExpense(3, 12)).status).toBe(403)
  })

  it('5xx y errores de red se tratan como red', async () => {
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await deleteGroupExpense(3, 12)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await deleteGroupExpense(3, 12)).toEqual({ ok: false, network: true })
  })
})

describe('lecturas de deudas, saldos y liquidación (022 T074)', () => {
  it.each([
    ['getPendingDebts', getPendingDebts, '/api/groups/3/debts/pending'],
    ['getGroupBalances', getGroupBalances, '/api/groups/3/balances'],
    ['getSettlementProposal', getSettlementProposal, '/api/groups/3/settlement-proposal'],
  ])('%s hace GET con la cookie y devuelve { ok, data }', async (_name, read, url) => {
    const fetchMock = respond(200, [{ debtId: 1 }])
    vi.stubGlobal('fetch', fetchMock)

    expect(await read(3)).toEqual({ ok: true, data: [{ debtId: 1 }] })
    expect(fetchMock.mock.calls[0][0]).toBe(url)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' })
  })

  it('404 y 401 devuelven el estado; 5xx y la red se tratan como red', async () => {
    vi.stubGlobal('fetch', respond(404, { detail: 'No existe el grupo solicitado o no sos miembro' }))
    expect(await getPendingDebts(3)).toMatchObject({ ok: false, status: 404 })
    vi.stubGlobal('fetch', respond(401, {}))
    expect((await getGroupBalances(3)).status).toBe(401)
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await getSettlementProposal(3)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getPendingDebts(3)).toEqual({ ok: false, network: true })
  })
})


describe('createFriendExpense (027 US4)', () => {
  it('201 envía la clave y el cuerpo a la ruta del amigo', async () => {
    vi.stubGlobal('fetch', respond(201, EXPENSE))
    const payload = { amount: '100.00', currency: 'ARS' }

    expect(await createFriendExpense(15, payload, 'key-1')).toEqual({ ok: true, expense: EXPENSE, created: true })
    expect(fetch).toHaveBeenCalledWith('/api/users/me/friends/15/expenses', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' },
      body: JSON.stringify(payload),
    })
  })

  it('200 es un reenvío idempotente', async () => {
    vi.stubGlobal('fetch', respond(200, EXPENSE))
    expect(await createFriendExpense(15, {}, 'k')).toMatchObject({ ok: true, created: false })
  })

  it('404, 400 y 422 devuelven el detalle, los campos y el código', async () => {
    vi.stubGlobal('fetch', respond(404, { detail: 'No sos amigo de ese usuario' }))
    expect(await createFriendExpense(15, {}, 'k')).toMatchObject({
      ok: false,
      status: 404,
      detail: 'No sos amigo de ese usuario',
    })

    vi.stubGlobal('fetch', respond(400, { properties: { fields: { payerUserId: 'Quien pagó tiene que ser vos o tu amigo' } } }))
    expect((await createFriendExpense(15, {}, 'k')).fields).toEqual({
      payerUserId: 'Quien pagó tiene que ser vos o tu amigo',
    })

    vi.stubGlobal('fetch', respond(422, { properties: { code: 'IDEMPOTENCY_KEY_REUSED' } }))
    expect(await createFriendExpense(15, {}, 'k')).toMatchObject({ status: 422, code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('5xx y errores de red son errores de red', async () => {
    vi.stubGlobal('fetch', respond(503, {}))
    expect(await createFriendExpense(15, {}, 'k')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await createFriendExpense(15, {}, 'k')).toEqual({ ok: false, network: true })
  })
})

describe('whistleDebt (030 T009)', () => {
  const SENT = { whistleId: 15, debtId: 42, debtorName: 'Juan Pérez', sentAt: 'a', nextAvailableAt: 'b' }

  it('201 manda POST con la cookie a la ruta de la deuda y devuelve { ok, data }', async () => {
    const fetchMock = respond(201, SENT)
    vi.stubGlobal('fetch', fetchMock)

    expect(await whistleDebt(3, 42)).toEqual({ ok: true, data: SENT })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/debts/42/whistle')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })

  it.each([
    [403, 'WHISTLE_NOT_CREDITOR', 'Solo quien recibe el pago puede avisar esta deuda'],
    [404, null, 'No existe el grupo solicitado o no sos miembro'],
    [409, 'DEBT_NOT_WHISTLEABLE', 'La deuda ya no tiene saldo pendiente'],
    [422, 'SIMULATED_DEBTOR', 'Los perfiles simulados no reciben avisos'],
    [503, 'WHISTLE_DELIVERY_FAILED', 'No pudimos enviar el aviso. Probá de nuevo en unos minutos'],
  ])('%s devuelve el estado, el detalle y el código', async (status, code, detail) => {
    vi.stubGlobal('fetch', respond(status, { detail, properties: code ? { code } : {} }))
    expect(await whistleDebt(3, 42)).toMatchObject({ ok: false, status, detail, code, retryAfterSeconds: null })
  })

  it('429 lee los segundos de espera del cuerpo o, si faltan, de la cabecera Retry-After', async () => {
    vi.stubGlobal('fetch', respond(429, {
      detail: 'Ya le avisaste a Juan Pérez en las últimas 24 horas',
      properties: { code: 'WHISTLE_RATE_LIMITED', retryAfterSeconds: 63600 },
    }))
    expect(await whistleDebt(3, 42)).toMatchObject({ ok: false, status: 429, retryAfterSeconds: 63600 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name) => (name === 'Retry-After' ? '120' : null) },
      json: () => Promise.resolve({}),
    }))
    expect(await whistleDebt(3, 42)).toMatchObject({ status: 429, retryAfterSeconds: 120 })
  })

  it('otros 5xx y la red se tratan como red; un cuerpo ilegible no rompe', async () => {
    vi.stubGlobal('fetch', respond(500, {}))
    expect(await whistleDebt(3, 42)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await whistleDebt(3, 42)).toEqual({ ok: false, network: true })
    vi.stubGlobal('fetch', respond(409, new Error('not json')))
    expect(await whistleDebt(3, 42)).toMatchObject({ ok: false, status: 409, detail: '', code: null })
  })
})
