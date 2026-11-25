import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EXPENSE_NETWORK_ERROR_MESSAGE,
  RECURRING_LOAD_ERROR_MESSAGE,
  RECURRING_UPDATE_ERROR_MESSAGE,
  createExpense,
  getExpense,
  getExpenseStatistics,
  STATISTICS_ERROR_MESSAGE,
  listExpenseYears,
  listRecentExpenses,
  searchExpenses,
  listRecurringExpenses,
  updateRecurringExpenseStatus,
} from './expenseClient'

const PAYLOAD = {
  amount: '10.10',
  currency: 'ARS',
  date: '2026-10-21',
  category: 'FOOD',
  type: 'ONE_TIME',
  paymentMethod: 'CASH',
  description: 'Almuerzo',
  deviceTimeZone: 'America/Argentina/Buenos_Aires',
}

const KEY = '3f1c8a8e-6a4e-4f0e-9b1e-0d8f5f3c2a10'

function response({ ok = false, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createExpense (T024)', () => {
  it('envía POST con cookie, cabecera de idempotencia y la zona horaria dentro del body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, status: 201, body: { id: 1 } }))
    vi.stubGlobal('fetch', fetchMock)

    await createExpense(PAYLOAD, KEY)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/expenses')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'Idempotency-Key': KEY,
    })
    expect(JSON.parse(options.body)).toEqual(PAYLOAD)
    expect(JSON.parse(options.body).deviceTimeZone).toBe('America/Argentina/Buenos_Aires')
  })

  it('201 devuelve el gasto creado', async () => {
    const expense = { id: 42, amount: '10.10' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      response({ ok: true, status: 201, body: expense }),
    ))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({ ok: true, expense })
  })

  it('200 trata el replay como éxito', async () => {
    const expense = { id: 42, amount: '10.10' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      response({ ok: true, status: 200, body: expense }),
    ))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({ ok: true, expense })
  })

  it('400 devuelve status, detalle y mensajes por campo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      status: 400,
      body: {
        detail: 'La solicitud contiene campos inválidos',
        properties: { fields: { amount: 'El monto es obligatorio' } },
      },
    })))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { amount: 'El monto es obligatorio' },
    })
  })

  it('401 se informa con su status para que el gate redirija', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({
      ok: false,
      status: 401,
      detail: '',
      fields: {},
    })
  })

  it('422 marca la clave reutilizada y conserva el detalle accionable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      status: 422,
      body: {
        detail: 'La operación ya fue registrada con datos distintos. Reintentá el guardado.',
        properties: { code: 'IDEMPOTENCY_KEY_REUSED' },
      },
    })))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({
      ok: false,
      status: 422,
      reusedKey: true,
      detail: 'La operación ya fue registrada con datos distintos. Reintentá el guardado.',
      code: 'IDEMPOTENCY_KEY_REUSED',
    })
  })

  it('5xx y fallos de red se informan como network con el mensaje fijo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 500 })))
    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({ ok: false, network: true })
    expect(EXPENSE_NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo guardar el gasto. Intenta nuevamente',
    )
  })

  it('ignora fields que no sean un objeto de mensajes (SC-006)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      status: 400,
      body: { properties: { fields: 'detalle interno' } },
    })))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toMatchObject({
      ok: false,
      status: 400,
      fields: {},
    })
  })

  it('un cuerpo de error no JSON no rompe el cliente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('not json')),
    }))

    await expect(createExpense(PAYLOAD, KEY)).resolves.toEqual({
      ok: false,
      status: 400,
      detail: '',
      fields: {},
    })
  })
})

describe('listRecurringExpenses (009, FR-012)', () => {
  it('pide GET /api/expenses/recurring con cookie y devuelve la lista', async () => {
    const series = [{ id: 81, status: 'ACTIVE' }]
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: series }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await listRecurringExpenses()).toEqual({ ok: true, expenses: series })
    expect(fetchMock).toHaveBeenCalledWith('/api/expenses/recurring', { credentials: 'include' })
  })

  it('un cuerpo que no es lista se trata como lista vacía', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, body: {} })))

    expect(await listRecurringExpenses()).toEqual({ ok: true, expenses: [] })
  })

  it('4xx devuelve el status; 5xx y fallo de red son network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))
    expect(await listRecurringExpenses()).toEqual({ ok: false, status: 401 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await listRecurringExpenses()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await listRecurringExpenses()).toEqual({ ok: false, network: true })
  })

  it('expone el mensaje fijo de carga', () => {
    expect(RECURRING_LOAD_ERROR_MESSAGE).toBe(
      'No se pudieron cargar tus gastos recurrentes. Intentá nuevamente',
    )
  })
})

describe('updateRecurringExpenseStatus (009, FR-009/FR-010)', () => {
  it('envía PATCH con el estado como JSON y devuelve la serie actualizada', async () => {
    const updated = { id: 81, status: 'PAUSED' }
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: updated }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await updateRecurringExpenseStatus(81, 'PAUSED')).toEqual({ ok: true, expense: updated })
    expect(fetchMock).toHaveBeenCalledWith('/api/expenses/81/status', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAUSED' }),
    })
  })

  it('409 expone el detalle y el código del ProblemDetail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          status: 409,
          body: {
            detail: 'El gasto recurrente ya está finalizado y no puede modificarse',
            properties: { code: 'RECURRENCE_FINISHED' },
          },
        }),
      ),
    )

    expect(await updateRecurringExpenseStatus(81, 'ACTIVE')).toEqual({
      ok: false,
      status: 409,
      detail: 'El gasto recurrente ya está finalizado y no puede modificarse',
      code: 'RECURRENCE_FINISHED',
    })
  })

  it('un 4xx sin cuerpo JSON no lanza', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.reject(new Error('x')) }),
    )

    expect(await updateRecurringExpenseStatus(81, 'PAUSED')).toEqual({
      ok: false,
      status: 404,
      detail: '',
      code: null,
    })
  })

  it('5xx y fallo de red son network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 500 })))
    expect(await updateRecurringExpenseStatus(81, 'PAUSED')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await updateRecurringExpenseStatus(81, 'PAUSED')).toEqual({ ok: false, network: true })
  })

  it('expone el mensaje fijo de actualización', () => {
    expect(RECURRING_UPDATE_ERROR_MESSAGE).toBe(
      'No se pudo actualizar el gasto recurrente. Intentá nuevamente',
    )
  })
})

describe('listRecentExpenses (015, FR-008)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    [response({ ok: true, body: [{ id: 1 }] }), { ok: true, expenses: [{ id: 1 }] }],
    [response({ ok: true, body: null }), { ok: true, expenses: [] }],
    [response({ status: 401 }), { ok: false, status: 401 }],
    [response({ status: 500 }), { ok: false, network: true }],
  ])('traduce la respuesta %#', async (answer, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer))

    await expect(listRecentExpenses()).resolves.toEqual(expected)
    expect(fetch).toHaveBeenCalledWith('/api/expenses/recent', { credentials: 'include' })
  })

  it('un fallo de red se informa como network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    await expect(listRecentExpenses()).resolves.toEqual({ ok: false, network: true })
  })
})

describe('searchExpenses (031)', () => {
  it('envía q, year, month, page y size con cookie y devuelve la página', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      ok: true,
      body: { expenses: [{ id: 1 }], page: 2, size: 9, totalElements: 12, totalPages: 2 },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchExpenses({ term: 'café', year: 2026, month: 3, page: 2, size: 9 })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/expenses/search?q=caf%C3%A9&year=2026&month=3&page=2&size=9',
      { credentials: 'include' },
    )
    expect(result).toEqual({
      ok: true, expenses: [{ id: 1 }], page: 2, totalElements: 12, totalPages: 2,
    })
  })

  it('omite los parámetros vacíos, nulos o ausentes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: {} }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchExpenses({ term: '', year: null, month: undefined, page: 1 })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/expenses/search?page=1')
    expect(result).toEqual({ ok: true, expenses: [], page: 1, totalElements: 0, totalPages: 0 })
  })

  it('sin argumentos pide la búsqueda sin parámetros', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: null }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchExpenses()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/expenses/search?')
    expect(result).toEqual({ ok: true, expenses: [], page: 1, totalElements: 0, totalPages: 0 })
  })

  it('ignora totales y páginas que no son enteros válidos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      ok: true,
      body: { expenses: 'x', page: 0, totalElements: -3, totalPages: '4' },
    })))

    expect(await searchExpenses({ term: 'ab' })).toEqual({
      ok: true, expenses: [], page: 1, totalElements: 0, totalPages: 0,
    })
  })

  it('devuelve los campos inválidos de un 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      response({ status: 400, body: { properties: { fields: { q: 'corto', otro: 3 } } } }),
    ))

    expect(await searchExpenses({ term: 'a' })).toEqual({ ok: false, status: 400, fields: { q: 'corto' } })
  })

  it('un 400 sin cuerpo JSON devuelve campos vacíos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401, json: () => Promise.reject(new Error('sin cuerpo')),
    }))

    expect(await searchExpenses({ term: 'ab' })).toEqual({ ok: false, status: 401, fields: {} })
  })

  it('trata 5xx y fallas de red como error de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await searchExpenses({ term: 'ab' })).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await searchExpenses({ term: 'ab' })).toEqual({ ok: false, network: true })
  })
})

describe('listExpenseYears (031)', () => {
  it('devuelve solo años enteros', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({ ok: true, body: { years: [2026, '2025', 2024] } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await listExpenseYears()).toEqual({ ok: true, years: [2026, 2024] })
    expect(fetchMock).toHaveBeenCalledWith('/api/expenses/years', { credentials: 'include' })
  })

  it('un cuerpo sin años devuelve una lista vacía', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, body: null })))
    expect(await listExpenseYears()).toEqual({ ok: true, years: [] })
  })

  it('distingue 4xx de 5xx y de fallas de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))
    expect(await listExpenseYears()).toEqual({ ok: false, status: 401 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 500 })))
    expect(await listExpenseYears()).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await listExpenseYears()).toEqual({ ok: false, network: true })
  })
})

describe('getExpense (031)', () => {
  it('pide el gasto por id con cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: { id: 7 } }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getExpense('7')).toEqual({ ok: true, expense: { id: 7 } })
    expect(fetchMock).toHaveBeenCalledWith('/api/expenses/7', { credentials: 'include' })
  })

  it('codifica el id y distingue 404, 5xx y fallas de red', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getExpense('a/b')).toEqual({ ok: false, status: 404 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/expenses/a%2Fb')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 502 })))
    expect(await getExpense('1')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await getExpense('1')).toEqual({ ok: false, network: true })
  })
})

describe('getExpenseStatistics (032)', () => {
  const BODY = {
    year: 2026,
    month: 11,
    currency: 'ARS',
    total: '160000.00',
    excludedCount: 1,
    personal: { total: '100000.00', categories: [{ category: 'FOOD', amount: '100000.00', percentage: '100.0' }] },
    group: { total: '60000.00', categories: [{ category: 'LEISURE', amount: '60000.00', percentage: '100.0' }] },
    years: [2026, '2025', 2024],
  }

  it('pide el período con cookie y devuelve las estadísticas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: BODY }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getExpenseStatistics({ year: '2026', month: 11 })

    expect(fetchMock).toHaveBeenCalledWith('/api/expenses/statistics?year=2026&month=11', {
      credentials: 'include',
    })
    expect(result).toEqual({
      ok: true,
      statistics: {
        currency: 'ARS',
        total: '160000.00',
        excludedCount: 1,
        personal: BODY.personal,
        group: BODY.group,
        years: [2026, 2024],
      },
    })
  })

  it('completa con valores vacíos un cuerpo incompleto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, body: null })))

    expect(await getExpenseStatistics({ year: 2026, month: 1 })).toEqual({
      ok: true,
      statistics: {
        currency: 'ARS',
        total: '0.00',
        excludedCount: 0,
        personal: { total: '0.00', categories: [] },
        group: { total: '0.00', categories: [] },
        years: [],
      },
    })
  })

  it('distingue 4xx de 5xx y de fallas de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 400 })))
    expect(await getExpenseStatistics({ year: 2026, month: 13 })).toEqual({ ok: false, status: 400 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 500 })))
    expect(await getExpenseStatistics({ year: 2026, month: 1 })).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await getExpenseStatistics({ year: 2026, month: 1 })).toEqual({ ok: false, network: true })
  })

  it('expone el mensaje fijo de error', () => {
    expect(STATISTICS_ERROR_MESSAGE).toBe('No pudimos cargar tus estadísticas. Intentá nuevamente')
  })
})
