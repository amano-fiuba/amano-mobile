// URL base de la API (amano-mobile specs/001-android-app, research.md D3; FR-004/FR-005).
// En la web VITE_API_BASE_URL está vacío y las rutas quedan relativas
// (`/api/...`), idénticas a las de siempre. En el build Android
// (`npm run build:android`, archivo `.env.android`) apunta al backend.

/** Quita espacios y barras finales; `undefined`/`null` → ''. */
export function normalizeBase(base) {
  return String(base ?? '').trim().replace(/\/+$/, '')
}

const CONFIGURED_BASE = normalizeBase(import.meta.env.VITE_API_BASE_URL)

/** Antepone la base configurada a una ruta de la API (`/api/...`). */
export function apiUrl(path, base = CONFIGURED_BASE) {
  const normalized = normalizeBase(base)
  if (!normalized || /^https?:\/\//i.test(path)) {
    return path
  }
  return `${normalized}${path.startsWith('/') ? '' : '/'}${path}`
}
