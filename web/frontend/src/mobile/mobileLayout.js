// Diseño móvil de la app Android (amano-mobile specs/002-diseno-movil-y-notificaciones).
//
// La app empaqueta el mismo frontend que la web (mobile 001). En el celular, las
// pantallas largas se reorganizan en pestañas, la navegación pasa a una barra
// inferior y los formularios largos se dividen en pasos. En la web nada cambia.
//
// Se activa si:
// - el build es el de Android (`VITE_MOBILE_LAYOUT=true` en `.env.android`), o
// - la SPA corre dentro de Capacitor, o
// - para probar en el navegador: abrir cualquier ruta con `?mobile=1`
//   (se recuerda; `?mobile=0` lo apaga).

const STORAGE_KEY = 'amano-mobile-layout'

function readOverride() {
  if (typeof window === 'undefined') return null
  try {
    const param = new URLSearchParams(window.location.search).get('mobile')
    if (param === '1' || param === '0') {
      window.localStorage.setItem(STORAGE_KEY, param)
    }
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === '1' ? true : stored === '0' ? false : null
  } catch {
    return null
  }
}

function detect() {
  if (import.meta.env.VITE_MOBILE_LAYOUT === 'true') return true
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return true
  return readOverride() === true
}

const MOBILE_LAYOUT = detect()

/** True cuando corre el diseño móvil; constante durante toda la sesión. */
export function isMobileLayout() {
  return MOBILE_LAYOUT
}

/** Marca el documento para que los estilos `.is-mobile-app` apliquen. */
export function markDocument(doc = typeof document === 'undefined' ? null : document) {
  if (MOBILE_LAYOUT && doc) {
    doc.documentElement.classList.add('is-mobile-app')
  }
}

// Rutas "de primer nivel": muestran la barra inferior. En el resto (detalles,
// formularios) la barra se oculta y la pantalla usa todo el alto.
const TOP_LEVEL = [
  /^\/$/,
  /^\/groups\/?$/,
  /^\/activity\/?$/,
  /^\/statistics\/?$/,
  /^\/friends\/?$/,
  /^\/profile\/?$/,
  /^\/notifications\/?$/,
  /^\/users\/search\/?$/,
  /^\/expenses\/recurring\/?$/,
  /^\/groups\/\d+\/?$/,
]

export function isTopLevelPath(pathname) {
  return TOP_LEVEL.some((pattern) => pattern.test(pathname))
}
