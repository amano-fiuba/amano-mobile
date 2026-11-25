import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SEARCH_NETWORK_ERROR_MESSAGE, searchUsers } from './usersClient'

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchUsers(endpoint: GET /api/users/search)', () => {
  it('200 devuelve ok con los usuarios y codifica el término en la URL', async () => {
    const users = [{ id: 3, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' }]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(users) }),
    )

    const result = await searchUsers('a&b %')

    expect(result).toEqual({ ok: true, users })
    expect(fetch).toHaveBeenCalledWith('/api/users/search?q=a%26b%20%25', {
      credentials: 'include',
    })
  })

  it('400 devuelve el detalle y los campos del ProblemDetail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: 'La solicitud contiene campos inválidos',
            properties: { fields: { q: 'Ingresá al menos 2 caracteres para buscar' } },
          }),
      }),
    )

    expect(await searchUsers('a')).toEqual({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { q: 'Ingresá al menos 2 caracteres para buscar' },
    })
  })

  it('401 devuelve el estado para que la página cierre la sesión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ title: 'No autorizado' }),
      }),
    )

    const result = await searchUsers('an')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
  })

  it('4xx con cuerpo no JSON no rompe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('no json')),
      }),
    )

    expect(await searchUsers('an')).toEqual({ ok: false, status: 400, detail: '', fields: {} })
  })

  it('5xx y fallo de red se tratan como network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    expect(await searchUsers('an')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await searchUsers('an')).toEqual({ ok: false, network: true })
  })

  it('SEARCH_NETWORK_ERROR_MESSAGE es el mensaje fijo de la spec', () => {
    expect(SEARCH_NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo completar la búsqueda. Intenta nuevamente',
    )
  })
})
