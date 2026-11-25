// API client for GET /api/users/search (feature 008, contracts/users-search-api.md).
// Same convention as authClient/expenseClient: never throws, always returns
// { ok: true, ... } or { ok: false, ... }.

import { apiUrl } from './apiBase'

export const SEARCH_NETWORK_ERROR_MESSAGE =
  'No se pudo completar la búsqueda. Intenta nuevamente'

/**
 * Searches verified users. Returns { ok: true, users } on 200; 4xx come back as
 * { ok: false, status, detail, fields } (400 invalid term, 401 no session);
 * network failures and 5xx as { ok: false, network: true }.
 */
export async function searchUsers(q) {
  try {
    const response = await fetch(apiUrl(`/api/users/search?q=${encodeURIComponent(q)}`), {
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true, users: await response.json() }
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
    return {
      ok: false,
      status: response.status,
      detail: problem.detail ?? '',
      fields: problem.properties?.fields ?? {},
    }
  } catch {
    return { ok: false, network: true }
  }
}
