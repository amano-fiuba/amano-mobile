// Imágenes protegidas por la cookie de sesión (amano-mobile specs/001-android-app, D12; FR-017).
// En la web el <img src="/api/..."> funciona solo. Dentro de la app Android la
// SPA corre en https://localhost: la imagen se pide por la capa HTTP nativa
// (CapacitorHttp), que envía la cookie `amano_auth`, y se devuelve como data URL.
import { apiUrl } from './apiBase'

const cache = new Map()

/** `window.Capacitor` solo existe dentro de la app; en la web devuelve null. */
export function nativeBridge() {
  const cap = typeof window === 'undefined' ? undefined : window.Capacitor
  return cap?.isNativePlatform?.() ? cap : null
}

/** True si la imagen debe pedirse por la capa nativa. */
export function needsNativeLoad(src) {
  return Boolean(nativeBridge()) && typeof src === 'string' && src.startsWith('/api/')
}

/** Descarga la imagen con la sesión nativa; devuelve una data URL o lanza. */
export function loadApiImage(src) {
  if (cache.has(src)) {
    return cache.get(src)
  }
  const cap = nativeBridge()
  const promise = cap
    .nativePromise('CapacitorHttp', 'request', {
      url: apiUrl(src),
      method: 'GET',
      responseType: 'blob',
      headers: {},
    })
    .then((response) => {
      if (response.status < 200 || response.status >= 300 || !response.data) {
        throw new Error(`HTTP ${response.status}`)
      }
      const type = response.headers?.['Content-Type'] || response.headers?.['content-type'] || 'image/jpeg'
      return `data:${type};base64,${response.data}`
    })
  promise.catch(() => cache.delete(src))
  cache.set(src, promise)
  return promise
}

/** Invalida la caché (por ejemplo, al cambiar el avatar). */
export function clearApiImageCache(src) {
  if (src) cache.delete(src)
  else cache.clear()
}
