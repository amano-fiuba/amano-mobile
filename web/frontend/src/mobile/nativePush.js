// Notificaciones en el celular (amano-mobile specs/002-diseno-movil-y-notificaciones, US4).
//
// La app Android trae el plugin @capacitor/push-notifications (repositorio amano-mobile). El
// frontend no depende de paquetes de Capacitor: habla con el plugin por el
// puente nativo que Capacitor inyecta en `window.Capacitor`, igual que
// ApiImage. En la web todas estas funciones no hacen nada.
import { registerPushDevice, unregisterPushDevice } from '../api/pushClient'

const PLUGIN = 'PushNotifications'
const TOKEN_KEY = 'amano-push-token'
// Debe coincidir con FcmPushSender.ANDROID_CHANNEL_ID del backend.
export const CHANNEL = {
  id: 'amano',
  name: 'Notificaciones de A mano',
  description: 'Solicitudes de amistad y avisos de tus grupos',
  importance: 4,
  visibility: 1,
  vibration: true,
}

// El build de la app lo pone en true solo si hay google-services.json
// (repositorio amano-mobile, scripts/build-web.mjs). Sin Firebase, pedir el token cierra la app.
function pushConfigured() {
  return import.meta.env.VITE_PUSH_ENABLED === 'true'
}

function bridge() {
  if (!pushConfigured()) return null
  const cap = typeof window === 'undefined' ? undefined : window.Capacitor
  if (!cap?.isNativePlatform?.()) return null
  const available =
    typeof cap.isPluginAvailable === 'function'
      ? cap.isPluginAvailable(PLUGIN)
      : (cap.PluginHeaders ?? []).some((header) => header.name === PLUGIN)
  return available ? cap : null
}

/** True dentro de la app con el plugin instalado. */
export function pushAvailable() {
  return Boolean(bridge())
}

function call(method, options = {}) {
  return bridge().nativePromise(PLUGIN, method, options)
}

/** Escucha un evento del plugin; devuelve la función para dejar de escucharlo. */
export function listen(eventName, handler) {
  const cap = bridge()
  if (!cap) return () => {}
  const callbackId = cap.nativeCallback(PLUGIN, 'addListener', { eventName }, handler)
  return () => {
    cap.nativePromise(PLUGIN, 'removeListener', { eventName, callbackId }).catch(() => {})
  }
}

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token)
    else window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // sin almacenamiento: al cerrar sesión no se podrá avisar al servidor
  }
}

/**
 * Pide permiso (Android 13+ muestra el cartel la primera vez), crea el canal y
 * registra el teléfono en Firebase. El token llega por el evento
 * `registration` y se guarda en el backend. Devuelve el estado del permiso.
 */
export async function enablePush() {
  if (!bridge()) return 'unavailable'
  let { receive } = await call('checkPermissions')
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    ;({ receive } = await call('requestPermissions'))
  }
  if (receive !== 'granted') return receive

  await call('createChannel', CHANNEL).catch(() => {})

  await new Promise((resolve) => {
    const stopOk = listen('registration', async ({ value }) => {
      stopOk()
      stopError()
      if (value) {
        const result = await registerPushDevice(value)
        if (result.ok) writeToken(value)
      }
      resolve()
    })
    const stopError = listen('registrationError', () => {
      stopOk()
      stopError()
      resolve()
    })
    call('register').catch(() => {
      stopOk()
      stopError()
      resolve()
    })
  })
  return 'granted'
}

/** Al cerrar sesión: el servidor deja de mandar notificaciones a este teléfono. */
export async function forgetPushDevice() {
  const token = readToken()
  if (!token) return
  writeToken(null)
  await unregisterPushDevice(token)
}

/** Ruta interna a abrir al tocar una notificación; ignora cualquier otra cosa. */
export function routeFromNotification(action) {
  const route = action?.notification?.data?.route
  return typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') ? route : null
}

/** Id de la notificación de la bandeja (web-035) que acompaña al aviso, o null. */
export function notificationIdFromAction(action) {
  const raw = action?.notification?.data?.notificationId
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}
