import { afterEach, describe, expect, it, vi } from 'vitest'
import { getStatisticsSummary, STATISTICS_ERROR_MESSAGE } from './statisticsClient'

function response({ ok = false, status = 200, body = {} } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

const BODY = {
  year: 2026,
  month: 11,
  currency: 'USD',
  expenses: {
    total: '160.00',
    excludedCount: 1,
    personal: { total: '100.00', categories: [{ category: 'FOOD', amount: '100.00', percentage: '100.0' }] },
    group: { total: '60.00', categories: [] },
  },
  income: {
    total: '1000.00',
    excludedCount: 2,
    categories: [{ category: 'SALARY', amount: '1000.00', percentage: '100.0' }],
  },
  comparison: { income: '1000.00', expenses: '160.00', balance: '840.00' },
  years: [2026, '2025', 2024],
}

afterEach(() => vi.unstubAllGlobals())

describe('getStatisticsSummary (034)', () => {
  it('pide el período con cookie y devuelve el resumen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: BODY }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getStatisticsSummary({ year: '2026', month: 11 })

    expect(fetchMock).toHaveBeenCalledWith('/api/stats/summary?year=2026&month=11', {
      credentials: 'include',
    })
    expect(result).toEqual({
      ok: true,
      statistics: {
        currency: 'USD',
        expenses: {
          total: '160.00',
          excludedCount: 1,
          personal: BODY.expenses.personal,
          group: BODY.expenses.group,
        },
        income: { ...BODY.income },
        comparison: BODY.comparison,
        years: [2026, 2024],
      },
    })
  })

  it('con todos los meses omite el parámetro month para que el resumen sea del año entero', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true, body: BODY }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getStatisticsSummary({ year: '2026', month: '' })

    expect(fetchMock).toHaveBeenCalledWith('/api/stats/summary?year=2026', {
      credentials: 'include',
    })
    expect(result.ok).toBe(true)
  })

  it('completa con valores neutros lo que falta en la respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, body: null })))

    const result = await getStatisticsSummary({ year: '2026', month: '11' })

    expect(result.statistics).toEqual({
      currency: 'ARS',
      expenses: {
        total: '0.00',
        excludedCount: 0,
        personal: { total: '0.00', categories: [] },
        group: { total: '0.00', categories: [] },
      },
      income: { total: '0.00', categories: [], excludedCount: 0 },
      comparison: { income: '0.00', expenses: '0.00', balance: '0.00' },
      years: [],
    })
  })

  it('devuelve el estado de un error 400 o 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 400 })))
    expect(await getStatisticsSummary({ year: 'x', month: '1' })).toEqual({ ok: false, status: 400 })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 401 })))
    expect(await getStatisticsSummary({ year: '2026', month: '1' })).toEqual({ ok: false, status: 401 })
  })

  it('un 5xx o un error de red es un fallo de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ status: 503 })))
    expect(await getStatisticsSummary({ year: '2026', month: '1' })).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getStatisticsSummary({ year: '2026', month: '1' })).toEqual({ ok: false, network: true })
  })

  it('expone el mensaje de error', () => {
    expect(STATISTICS_ERROR_MESSAGE).toBe('No pudimos cargar tus estadísticas. Intentá nuevamente')
  })
})
