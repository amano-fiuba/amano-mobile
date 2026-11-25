// Teléfonos que reciben notificaciones (amano-mobile specs/002-diseno-movil-y-notificaciones, US4;
// backend PushDeviceController). Solo los usa la app Android.
import { apiUrl } from './apiBase'

const PATH = '/api/users/me/push-devices'

function request(method, token) {
  return fetch(apiUrl(PATH), {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: 'ANDROID' }),
  })
    .then((response) => ({ ok: response.ok, status: response.status }))
    .catch(() => ({ ok: false, network: true }))
}

/** Asocia el teléfono a la sesión actual (idempotente). */
export function registerPushDevice(token) {
  return request('PUT', token)
}

/** Deja de enviar notificaciones a este teléfono (al cerrar sesión). */
export function unregisterPushDevice(token) {
  return request('DELETE', token)
}
