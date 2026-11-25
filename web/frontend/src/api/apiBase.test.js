import { describe, expect, it } from 'vitest'
import { apiUrl, normalizeBase } from './apiBase'

// amano-mobile specs/001-android-app (D3; FR-004, FR-005, FR-006).
describe('apiUrl', () => {
  it('sin base (la web) deja la ruta relativa igual que siempre', () => {
    expect(apiUrl('/api/users/me', '')).toBe('/api/users/me')
    expect(apiUrl('/api/users/me')).toBe('/api/users/me')
  })

  it('con base (Android) la antepone', () => {
    expect(apiUrl('/api/groups/3', 'https://amano.example')).toBe('https://amano.example/api/groups/3')
  })

  it('tolera barras finales, espacios y rutas sin barra inicial', () => {
    expect(apiUrl('/api/x', ' https://amano.example// ')).toBe('https://amano.example/api/x')
    expect(apiUrl('api/x', 'https://amano.example')).toBe('https://amano.example/api/x')
  })

  it('no toca URLs absolutas', () => {
    expect(apiUrl('https://otro.example/api/x', 'https://amano.example')).toBe(
      'https://otro.example/api/x',
    )
  })

  it('normalizeBase convierte null/undefined en vacío', () => {
    expect(normalizeBase(undefined)).toBe('')
    expect(normalizeBase(null)).toBe('')
  })
})

// FR-006: una feature nueva que llame a fetch('/api/...') sin apiUrl rompería la
// app Android sin que nadie lo note. Esta prueba lo detecta y nombra el archivo.
describe('guardia: todo fetch a la API pasa por apiUrl', () => {
  const sources = import.meta.glob(['../**/*.{js,jsx}', '!../**/*.test.{js,jsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  it('ningún fetch recibe un literal /api', () => {
    const offenders = Object.entries(sources)
      .filter(([, code]) => /\bfetch\(\s*[`'"]\/api/.test(code))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it('ningún fetch recibe una variable sin pasar por apiUrl', () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.endsWith('apiImage.js'))
      .filter(([, code]) => /\bfetch\(\s*(?!apiUrl\()[^)\s]/.test(code))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
