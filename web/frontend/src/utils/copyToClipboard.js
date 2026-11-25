/**
 * Copia texto al portapapeles. Usa la API moderna cuando está disponible
 * (contexto seguro: HTTPS o localhost) y cae a un textarea temporal con
 * `execCommand('copy')` para navegadores/contextos que no la exponen.
 * Devuelve `true` solo si la copia se completó.
 */
export async function copyToClipboard(text) {
  if (text == null || text === '') {
    return false
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permiso denegado o contexto no seguro: se intenta el fallback.
    }
  }

  let textarea
  try {
    textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    return document.execCommand?.('copy') ?? false
  } catch {
    return false
  } finally {
    textarea?.remove()
  }
}
