// Feature 034 (specs/034-income-statistics/contracts/statistics-summary-api.md).
import { apiUrl } from './apiBase'

export const STATISTICS_ERROR_MESSAGE =
  'No pudimos cargar tus estadísticas. Intentá nuevamente'

const ZERO = '0.00'

function amountOf(value) {
  return typeof value === 'string' ? value : ZERO
}

function countOf(value) {
  return Number.isInteger(value) ? value : 0
}

function breakdownOf(value) {
  return {
    total: amountOf(value?.total),
    categories: Array.isArray(value?.categories) ? value.categories : [],
  }
}

/**
 * GET /api/stats/summary?year=&month= ({ ok: true, statistics } on 200,
 * { ok: false, status } on 4xx (400 invalid period, 401 no session) and
 * { ok: false, network: true } on 5xx or network failures, plan D11). `month` is
 * left out when "Todos los meses" is chosen, so the backend sums the whole year.
 */
export async function getStatisticsSummary({ year, month }) {
  const params = new URLSearchParams({ year: String(year) })
  if (month !== '' && month != null) {
    params.set('month', String(month))
  }
  try {
    const response = await fetch(apiUrl(`/api/stats/summary?${params}`), { credentials: 'include' })
    if (response.ok) {
      const body = (await response.json()) ?? {}
      return {
        ok: true,
        statistics: {
          currency: typeof body.currency === 'string' ? body.currency : 'ARS',
          expenses: {
            total: amountOf(body.expenses?.total),
            excludedCount: countOf(body.expenses?.excludedCount),
            personal: breakdownOf(body.expenses?.personal),
            group: breakdownOf(body.expenses?.group),
          },
          income: {
            ...breakdownOf(body.income),
            excludedCount: countOf(body.income?.excludedCount),
          },
          comparison: {
            income: amountOf(body.comparison?.income),
            expenses: amountOf(body.comparison?.expenses),
            balance: amountOf(body.comparison?.balance),
          },
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
