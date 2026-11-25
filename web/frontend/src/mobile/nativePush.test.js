import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHANNEL,
  enablePush,
  forgetPushDevice,
  listen,
  notificationIdFromAction,
  pushAvailable,
  routeFromNotification,
} from './nativePush'

// Puente nativo simulado: guarda los listeners y responde a los métodos del plugin.
function installBridge({ permission = 'granted', afterRequest = 'granted', token = 'fcm-token-1' } = {}) {
  const listeners = {}
  let nextId = 1
  const calls = []
  const nativePromise = vi.fn(async (plugin, method, options) => {
    calls.push([plugin, method, options])
    if (method === 'checkPermissions') return { receive: permission }
    if (method === 'requestPermissions') return { receive: afterRequest }
    if (method === 'register') {
      queueMicrotask(() => {
        Object.values(listeners)
          .filter((entry) => entry.eventName === 'registration')
          .forEach((entry) => entry.handler({ value: token }))
      })
    }
    if (method === 'removeListener') delete listeners[options.callbackId]
    return {}
  })
  const nativeCallback = vi.fn((plugin, method, { eventName }, handler) => {
    const id = String(nextId++)
    listeners[id] = { eventName, handler }
    return id
  })
  window.Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: (name) => name === 'PushNotifications',
    nativePromise,
    nativeCallback,
  }
  return { calls, listeners, emit: (eventName, data) => Object.values(listeners)
    .filter((entry) => entry.eventName === eventName)
    .forEach((entry) => entry.handler(data)) }
}

let fetchMock
beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  // Build de la app con google-services.json (repositorio amano-mobile, scripts/build-web.mjs).
  vi.stubEnv('VITE_PUSH_ENABLED', 'true')
})

afterEach(() => {
  delete window.Capacitor
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('nativePush en la web', () => {
  it('no hace nada', async () => {
    expect(pushAvailable()).toBe(false)
    expect(await enablePush()).toBe('unavailable')
    expect(listen('registration', () => {})).toBeTypeOf('function')
    await forgetPushDevice()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('nativePush sin Firebase configurado', () => {
  it('no pide el token aunque esté el plugin (evita que la app se cierre)', async () => {
    vi.stubEnv('VITE_PUSH_ENABLED', 'false')
    const bridge = installBridge()
    expect(pushAvailable()).toBe(false)
    expect(await enablePush()).toBe('unavailable')
    expect(bridge.calls).toEqual([])
  })
})

describe('nativePush en la app', () => {
  it('pide permiso, crea el canal, registra el teléfono y guarda el token en el servidor', async () => {
    const bridge = installBridge({ permission: 'prompt' })

    expect(await enablePush()).toBe('granted')

    const methods = bridge.calls.map(([, method]) => method)
    expect(methods).toEqual(
      expect.arrayContaining(['checkPermissions', 'requestPermissions', 'createChannel', 'register']),
    )
    expect(bridge.calls.find(([, method]) => method === 'createChannel')[2]).toEqual(CHANNEL)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me/push-devices',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ token: 'fcm-token-1', platform: 'ANDROID' }),
      }),
    )
    expect(window.localStorage.getItem('amano-push-token')).toBe('fcm-token-1')
  })

  it('si la persona no da permiso, no registra nada', async () => {
    const bridge = installBridge({ permission: 'prompt', afterRequest: 'denied' })

    expect(await enablePush()).toBe('denied')

    expect(bridge.calls.map(([, method]) => method)).not.toContain('register')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('al cerrar sesión borra el token del servidor', async () => {
    installBridge()
    await enablePush()
    fetchMock.mockClear()

    await forgetPushDevice()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/me/push-devices',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(window.localStorage.getItem('amano-push-token')).toBeNull()
  })

  it('listen devuelve una función que deja de escuchar', () => {
    const bridge = installBridge()
    const handler = vi.fn()
    const stop = listen('pushNotificationReceived', handler)
    bridge.emit('pushNotificationReceived', { title: 'Hola' })
    expect(handler).toHaveBeenCalledWith({ title: 'Hola' })
    stop()
    expect(bridge.calls.at(-1)[1]).toBe('removeListener')
  })
})

describe('routeFromNotification', () => {
  it.each([
    [{ notification: { data: { route: '/friends' } } }, '/friends'],
    [{ notification: { data: { route: 'https://otro.example' } } }, null],
    [{ notification: { data: { route: '//otro.example' } } }, null],
    [{ notification: { data: {} } }, null],
    [null, null],
  ])('%j → %s', (action, expected) => {
    expect(routeFromNotification(action)).toBe(expected)
  })
})

describe('notificationIdFromAction', () => {
  it.each([
    [{ notification: { data: { notificationId: '40' } } }, 40],
    [{ notification: { data: { notificationId: 'abc' } } }, null],
    [{ notification: { data: { notificationId: '-3' } } }, null],
    [{ notification: { data: {} } }, null],
  ])('%j → %s', (action, expected) => {
    expect(notificationIdFromAction(action)).toBe(expected)
  })
})
