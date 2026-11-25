import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  searchCandidates,
  addMember,
  getActivity,
  removeMember,
  removeSimulatedProfile,
  leaveGroup,
  grantAdminRole,
  revokeAdminRole,
  getReminderSettings,
  updateReminderSettings,
  getExchangeQuote,
  GROUPS_NETWORK_ERROR_MESSAGE,
} from './groupsClient'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('groupsClient', () => {
  it('createGroup resuelve { ok, group } en 201 y manda el payload como JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, name: 'Trip' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createGroup({ name: 'Trip', member: { memberType: 'SIMULATED' } })

    expect(result).toEqual({ ok: true, group: { id: 1, name: 'Trip' } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/groups')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ name: 'Trip', member: { memberType: 'SIMULATED' } }))
  })

  it('createGroup manda primaryCurrency en el cuerpo (022 T068)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, primaryCurrency: 'USD' }, 201))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createGroup({ name: 'Trip', primaryCurrency: 'USD', members: [] })

    expect(result.ok).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ primaryCurrency: 'USD' })
  })

  it('getExchangeQuote pide GET /exchange-quote con moneda y fecha y devuelve { ok, quote } (022 T069)', async () => {
    const quote = { rate: 1250.5, rateDate: '2026-01-16', rateSource: 'BCRA', groupCurrency: 'ARS' }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(quote))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getExchangeQuote(3, 'USD', '2026-01-18')

    expect(result).toEqual({ ok: true, quote })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/groups/3/exchange-quote?currency=USD&date=2026-01-18')
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
  })

  it('getExchangeQuote devuelve estado y detalle en errores HTTP, y network sin conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Sin cotización' }, 503)))
    expect(await getExchangeQuote(3, 'USD', '2026-01-18'))
      .toEqual({ ok: false, status: 503, detail: 'Sin cotización' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await getExchangeQuote(3, 'USD', '2026-01-18')).toEqual({ ok: false, network: true })
  })

  it('createGroup mapea los fields del ProblemDetail en 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(
        { detail: 'member', properties: { fields: { name: 'El nombre del grupo es obligatorio' } } },
        400,
      ),
    ))

    const result = await createGroup({})

    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
    expect(result.fields.name).toBe('El nombre del grupo es obligatorio')
  })

  it('createGroup acepta fields con objetos y devuelve el detalle como fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(
        { detail: 'falla', properties: { fields: { member: { notAString: true } } } },
        400,
      ),
    ))

    const result = await createGroup({})

    expect(result.fields.member).toBe(JSON.stringify({ notAString: true }))
  })

  it('createGroup devuelve network en errores de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    expect(await createGroup({})).toEqual({ ok: false, network: true })
  })

  it('listGroups devuelve grupos en 200 y fields en errores', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse([{ id: 3, name: 'Departamento 2026' }]))
      .mockResolvedValueOnce(jsonResponse({ detail: 'sin sesión' }, 401))
    vi.stubGlobal('fetch', fetchMock)

    expect(await listGroups()).toEqual({ ok: true, groups: [{ id: 3, name: 'Departamento 2026' }] })
    const failure = await listGroups()
    expect(failure.ok).toBe(false)
    expect(failure.fields.member).toBe('sin sesión')
  })

  it('listGroups normaliza respuestas que no son array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null)))

    expect(await listGroups()).toEqual({ ok: true, groups: [] })
  })

  it('getGroup trae el grupo y reporta el 404 con fields', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ id: 3, currentUserRole: 'ADMIN' }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'No existe el grupo' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    expect((await getGroup(3)).group.id).toBe(3)
    const failure = await getGroup(999)
    expect(failure.ok).toBe(false)
    expect(failure.fields.member).toBe('No existe el grupo')
  })

  it('updateGroup devuelve los fields de la respuesta y usa el mensaje por defecto', async () => {
    let fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 3 }))
    vi.stubGlobal('fetch', fetchMock)
    const ok = await updateGroup(3, { name: 'Nuevo' })
    expect(ok.ok).toBe(true)

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 403)))
    const failure = await updateGroup(3, {})
    expect(failure.detail).toBe('No se pudo crear el grupo. Intenta nuevamente')
  })

  it('searchCandidates codifica el query y devuelve content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ id: 5 }] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchCandidates(3, 'Carla Gómez')

    expect((result.content ?? []).length).toBe(1)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/groups/3/candidates?q=${encodeURIComponent('Carla Gómez')}`)
  })

  it('addMember devuelve el miembro o el detalle del rechazo', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ member: { userId: 15 } }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Ya es miembro' }, 400))
    vi.stubGlobal('fetch', fetchMock)

    expect(await addMember(3, { memberType: 'SIMULATED' }))
      .toEqual({ ok: true, member: { userId: 15 } })
    const failure = await addMember(3, { memberType: 'REGISTERED' })
    expect(failure.detail).toBe('Ya es miembro')
  })

  it('getActivity arma los params y agrega eventType solo si viene', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await getActivity(3)
    await getActivity(3, { page: 2, size: 10, eventType: 'MEMBER_LEFT' })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/activity?page=1&size=20')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/3/activity?page=2&size=10&eventType=MEMBER_LEFT')
  })

  it('getActivity manda eventTypes separados por coma y credenciales (014)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [], totalPages: 0 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getActivity(3, { eventTypes: ['MEMBER_REMOVED', 'MEMBER_LEFT'] })
    await getActivity(3, { eventTypes: [] })

    expect(result).toEqual({ ok: true, content: [], totalPages: 0 })
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/groups/3/activity?page=1&size=20&eventType=MEMBER_REMOVED%2CMEMBER_LEFT',
    )
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'GET', credentials: 'include' })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/3/activity?page=1&size=20')
  })

  it('getActivity distingue 4xx, 5xx y fallas de red (014)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'No sos miembro' }, 404)))
    expect(await getActivity(3)).toEqual({ ok: false, status: 404, detail: 'No sos miembro' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: () => Promise.reject(new Error('sin cuerpo')),
    }))
    expect(await getActivity(3)).toEqual({ ok: false, status: 400, detail: undefined })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))
    expect(await getActivity(3)).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await getActivity(3)).toEqual({ ok: false, network: true })
  })

  it('removeMember y removeSimulatedProfile hacen DELETE con la URL correcta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ removed: true }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await removeMember(3, 15)).toEqual({ ok: true, removed: true })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/members/15')

    expect(await removeSimulatedProfile(3, 33)).toEqual({ ok: true, removed: true })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/3/simulated-profiles/33')
  })

  it('leaveGroup propaga el detalle del rechazo server-side', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ detail: 'No podés abandonar el grupo: tenés saldos pendientes con otros miembros' }, 403),
    ))

    const result = await leaveGroup(3)

    expect(result.ok).toBe(false)
    expect(result.detail).toContain('saldos pendientes')
  })

  it('grantAdminRole y revokeAdminRole usan endpoints separados', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ targetUserId: 15, newRole: 'ADMIN' }))
      .mockResolvedValueOnce(jsonResponse({ targetUserId: 15, newRole: 'MEMBER' }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Sos el último' }, 403))
    vi.stubGlobal('fetch', fetchMock)

    expect(await grantAdminRole(3, 15)).toEqual({ ok: true, targetUserId: 15, newRole: 'ADMIN' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/members/15/admin')

    expect(await revokeAdminRole(3, 15)).toEqual({ ok: true, targetUserId: 15, newRole: 'MEMBER' })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/groups/3/members/15/admin')

    const failure = await grantAdminRole(3, 15)
    expect(failure.detail).toBe('Sos el último')
  })

  it('getReminderSettings devuelve la configuración y mapea el error del backend', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        sendDays: 7, message: null, defaultSendDays: 5, allowedSendDays: [7, 5, 3, 1],
      }))
      .mockResolvedValueOnce(jsonResponse({ detail: 'Solo un administrador puede ver la configuración de recordatorios' }, 403))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getReminderSettings(3)).toEqual({
      ok: true,
      settings: { sendDays: 7, message: null, defaultSendDays: 5, allowedSendDays: [7, 5, 3, 1] },
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/reminder-settings')

    const failure = await getReminderSettings(3)
    expect(failure.ok).toBe(false)
    expect(failure.status).toBe(403)
    expect(failure.detail).toBe('Solo un administrador puede ver la configuración de recordatorios')
  })

  it('updateReminderSettings manda el payload parcial y mapea fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        sendDays: 3, message: 'Hola', defaultSendDays: 5, allowedSendDays: [7, 5, 3, 1],
      }))
      .mockResolvedValueOnce(jsonResponse({
        detail: 'Revisá los datos',
        properties: { fields: { sendDays: 'El tiempo de envío debe ser 7, 5, 3 o 1 días antes' } },
      }, 400))
    vi.stubGlobal('fetch', fetchMock)

    const ok = await updateReminderSettings(3, { sendDays: 3 })
    expect(ok.ok).toBe(true)
    expect(ok.settings.sendDays).toBe(3)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/groups/3/reminder-settings')
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ sendDays: 3 }))

    const failure = await updateReminderSettings(3, { sendDays: 4 })
    expect(failure.ok).toBe(false)
    expect(failure.fields.sendDays).toBe('El tiempo de envío debe ser 7, 5, 3 o 1 días antes')
  })

  it('los endpoints de recordatorios devuelven network cuando el fetch se corta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    expect(await getReminderSettings(1)).toEqual({ ok: false, network: true })
    expect(await updateReminderSettings(1, { sendDays: 5 })).toEqual({ ok: false, network: true })
  })

  it('los endpoints de groups devuelven network cuando el fetch se corta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))

    expect((await removeMember(1, 2)).detail).toBeUndefined()
    expect(await removeMember(1, 2)).toEqual({ ok: false, network: true })
    expect(await removeSimulatedProfile(1, 2)).toEqual({ ok: false, network: true })
    expect(await leaveGroup(1)).toEqual({ ok: false, network: true })
    expect(await grantAdminRole(1, 2)).toEqual({ ok: false, network: true })
    expect(await revokeAdminRole(1, 2)).toEqual({ ok: false, network: true })
    expect((await getGroup(1)).network).toBe(true)
    expect(GROUPS_NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo conectar con el servidor. Intenta nuevamente',
    )
  })
})
