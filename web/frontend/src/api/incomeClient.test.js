import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as incomeClient from './incomeClient'
import {
  createIncome,
  getBalance,
  getIncome,
  listIncomeYears,
  searchIncomes,
} from './incomeClient'

const PAYLOAD = {
  amount: '850000.00',
  currency: 'ARS',
  date: '2026-11-17',
  category: 'SALARY',
  paymentMethod: 'TRANSFER',
  description: 'Sueldo',
  deviceTimeZone: 'America/Argentina/Buenos_Aires',
}
const KEY = '3f1c8a8e-6a4e-4f0e-9b1e-0d8f5f3c2a10'

function response({ ok = false, status = 200, body = {} } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createIncome (033)', () => {
  it('envía POST con cookie, cabecera de idempotencia y el payload en el body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, status: 201, body: { id: 1 } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createIncome(PAYLOAD, KEY)

    expect(fetchMock).toHaveBeenCalledWith('/api/incomes', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': KEY },
      body: JSON.stringify(PAYLOAD),
    })
    expect(result).toEqual({ ok: true, income: { id: 1 } })
  })

  it('un reintento idéntico (200) también es un éxito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, status: 200, body: { id: 1 } })))

    expect(await createIncome(PAYLOAD, KEY)).toEqual({ ok: true, income: { id: 1 } })
  })

  it('devuelve los errores por campo de un 400 y descarta los que no son texto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 400,
          body: {
            detail: 'Datos inválidos',
            properties: { fields: { amount: 'El monto debe ser mayor a cero', extra: 3 } },
          },
        }),
      ),
    )

    expect(await createIncome(PAYLOAD, KEY)).toEqual({
      ok: false,
      status: 400,
      detail: 'Datos inválidos',
      fields: { amount: 'El monto debe ser mayor a cero' },
    })
  })

  it('un 422 indica que la clave se reutilizó con otro cuerpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 422,
          body: { detail: 'Ya registrada', properties: { code: 'IDEMPOTENCY_KEY_REUSED' } },
        }),
      ),
    )

    expect(await createIncome(PAYLOAD, KEY)).toEqual({
      ok: false,
      status: 422,
      reusedKey: true,
      detail: 'Ya registrada',
      code: 'IDEMPOTENCY_KEY_REUSED',
    })
  })

  it('un 401 sin cuerpo devuelve el estado y campos vacíos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.reject(new Error('sin cuerpo')),
      }),
    )

    expect(await createIncome(PAYLOAD, KEY)).toEqual({
      ok: false,
      status: 401,
      detail: '',
      fields: {},
    })
  })

  it('un 5xx o un fallo de red es un error de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await createIncome(PAYLOAD, KEY)).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await createIncome(PAYLOAD, KEY)).toEqual({ ok: false, network: true })
  })
})

describe('getBalance (033)', () => {
  const BALANCE = { currency: 'ARS', income: '10.00', expenses: '4.00', net: '6.00' }

  it('pide el balance sin parámetros cuando no hay período', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: BALANCE }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getBalance()

    expect(fetchMock).toHaveBeenCalledWith('/api/balance', { credentials: 'include' })
    expect(result).toEqual({ ok: true, balance: BALANCE })
  })

  it('envía solo los parámetros informados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: BALANCE }))
    vi.stubGlobal('fetch', fetchMock)

    await getBalance({ year: '2026', month: '3', from: '', to: null })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/balance?year=2026&month=3')
  })

  it('devuelve el estado y los campos de un 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({ status: 400, body: { properties: { fields: { month: 'El mes no es válido' } } } }),
      ),
    )

    expect(await getBalance({ month: '13' })).toEqual({
      ok: false,
      status: 400,
      fields: { month: 'El mes no es válido' },
    })
  })

  it('un 503 (cotización no disponible) y un fallo de red son errores de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await getBalance()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getBalance()).toEqual({ ok: false, network: true })
  })
})

describe('getIncome (033)', () => {
  it('pide el ingreso por id con la cookie y devuelve el cuerpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: { id: 5 } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getIncome('5')

    expect(fetchMock).toHaveBeenCalledWith('/api/incomes/5', { credentials: 'include' })
    expect(result).toEqual({ ok: true, income: { id: 5 } })
  })

  it('codifica el id en la ruta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await getIncome('a/b')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/incomes/a%2Fb')
  })

  it('devuelve el estado de un 404 o 401 y un error de red ante 5xx o fallos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 404 })))
    expect(await getIncome('9')).toEqual({ ok: false, status: 404 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))
    expect(await getIncome('9')).toEqual({ ok: false, status: 401 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 500 })))
    expect(await getIncome('9')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getIncome('9')).toEqual({ ok: false, network: true })
  })
})

describe('searchIncomes (033)', () => {
  const PAGE = { incomes: [{ id: 1 }], page: 2, totalElements: 11, totalPages: 3 }

  it('envía solo los criterios informados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: PAGE }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchIncomes({
      term: 'sueldo',
      year: '2026',
      month: '',
      page: 2,
      size: 7,
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/incomes/search?q=sueldo&year=2026&page=2&size=7')
    expect(fetchMock.mock.calls[0][1]).toEqual({ credentials: 'include' })
    expect(result).toEqual({
      ok: true,
      incomes: [{ id: 1 }],
      page: 2,
      totalElements: 11,
      totalPages: 3,
    })
  })

  it('sin criterios pide todo y normaliza un cuerpo incompleto', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchIncomes()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/incomes/search?')
    expect(result).toEqual({ ok: true, incomes: [], page: 1, totalElements: 0, totalPages: 0 })
  })

  it('devuelve el estado y los campos de un 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({ status: 400, body: { properties: { fields: { q: 'Muy corto', x: 1 } } } }),
      ),
    )

    expect(await searchIncomes({ term: 'a' })).toEqual({
      ok: false,
      status: 400,
      fields: { q: 'Muy corto' },
    })
  })

  it('un 5xx o un fallo de red es un error de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 502 })))
    expect(await searchIncomes()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await searchIncomes()).toEqual({ ok: false, network: true })
  })
})

describe('listIncomeYears (033)', () => {
  it('devuelve los años enteros y descarta lo que no lo sea', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({ ok: true, body: { years: [2026, '2025', 2024, null] } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await listIncomeYears()).toEqual({ ok: true, years: [2026, 2024] })
    expect(fetchMock).toHaveBeenCalledWith('/api/incomes/years', { credentials: 'include' })
  })

  it('tolera un cuerpo sin años', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, body: {} })))

    expect(await listIncomeYears()).toEqual({ ok: true, years: [] })
  })

  it('devuelve el estado de un 401 y un error de red ante 5xx o fallos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))
    expect(await listIncomeYears()).toEqual({ ok: false, status: 401 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await listIncomeYears()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await listIncomeYears()).toEqual({ ok: false, network: true })
  })
})

describe('incomeClient: registros inmutables (033, US3)', () => {
  it('no exporta funciones de actualización ni de borrado', () => {
    const names = Object.keys(incomeClient).filter((name) => typeof incomeClient[name] === 'function')
    expect(names.sort()).toEqual(
      ['createIncome', 'getBalance', 'getIncome', 'listIncomeYears', 'searchIncomes'].sort(),
    )
    expect(names.some((name) => /update|edit|patch|put|delete|remove/i.test(name))).toBe(false)
  })
})
