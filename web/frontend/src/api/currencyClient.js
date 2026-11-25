// API client for GET /api/currencies (027, contracts/currencies-api.md): the BCRA
// catalog of the "Ver más" dialog. A 503 means the BCRA is down and nothing is cached.

import { apiUrl } from './apiBase'

/**
 * Returns { ok: true, currencies } on 200, { ok: false, unavailable: true } on
 * 503, { ok: false, network: true } on other 5xx or network failures and
 * { ok: false, status } on other errors (e.g. 401).
 */
export async function listCurrencies() {
  try {
    const response = await fetch(apiUrl('/api/currencies'), { credentials: 'include' })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, currencies: Array.isArray(body?.currencies) ? body.currencies : [] }
    }
    if (response.status === 503) {
      return { ok: false, unavailable: true }
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
 * 027 FR-035: GET /api/currencies/quote, preview of an amount in pesos for the
 * personal expense. Same shape as getExchangeQuote of groupsClient:
 * { ok: true, quote } or { ok: false, status } / { ok: false, network: true }.
 */
export async function getCurrencyQuote(currency, date) {
  try {
    const params = new URLSearchParams({ currency, date })
    const response = await fetch(apiUrl(`/api/currencies/quote?${params.toString()}`), { credentials: 'include' })
    if (!response.ok) {
      return { ok: false, status: response.status }
    }
    return { ok: true, quote: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}
