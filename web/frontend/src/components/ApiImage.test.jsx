import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ApiImage from './ApiImage'
import { clearApiImageCache } from '../api/apiImage'

// amano-mobile specs/001-android-app (D12; FR-017, FR-018).
afterEach(() => {
  delete window.Capacitor
  clearApiImageCache()
})

function nativeBridge(response) {
  const nativePromise = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  window.Capacitor = { isNativePlatform: () => true, nativePromise }
  return nativePromise
}

describe('ApiImage', () => {
  it('en la web dibuja el mismo <img src>', () => {
    render(<ApiImage src="/api/users/7/avatar?v=3" alt="Avatar de Ana" />)
    expect(screen.getByAltText('Avatar de Ana')).toHaveAttribute('src', '/api/users/7/avatar?v=3')
  })

  it('sin src muestra el avatar por defecto', () => {
    render(<ApiImage src={null} alt="Avatar" />)
    expect(screen.getByAltText('Avatar')).toHaveAttribute('src', '/avatar-default.png')
  })

  it('en la app pide la imagen por la capa nativa y usa la data URL', async () => {
    const nativePromise = nativeBridge({
      status: 200,
      data: 'AAAA',
      headers: { 'Content-Type': 'image/png' },
    })
    render(<ApiImage src="/api/groups/3/photo" alt="Foto" />)

    expect(screen.getByAltText('Foto')).toHaveAttribute('src', '/avatar-default.png')
    await waitFor(() =>
      expect(screen.getByAltText('Foto')).toHaveAttribute('src', 'data:image/png;base64,AAAA'),
    )
    expect(nativePromise).toHaveBeenCalledWith(
      'CapacitorHttp',
      'request',
      expect.objectContaining({ url: '/api/groups/3/photo', responseType: 'blob' }),
    )
  })

  it('en la app, si falla, queda el avatar por defecto', async () => {
    const nativePromise = nativeBridge({ status: 404, data: '' })
    render(<ApiImage src="/api/users/9/avatar" alt="Avatar" />)
    await waitFor(() => expect(nativePromise).toHaveBeenCalled())
    expect(screen.getByAltText('Avatar')).toHaveAttribute('src', '/avatar-default.png')
  })

  it('en la app, las imágenes locales (blob:, estáticas) no pasan por la capa nativa', () => {
    const nativePromise = nativeBridge({ status: 200, data: 'AAAA' })
    render(<ApiImage src="blob:preview" alt="Vista previa" />)
    expect(screen.getByAltText('Vista previa')).toHaveAttribute('src', 'blob:preview')
    expect(nativePromise).not.toHaveBeenCalled()
  })
})

// FR-018: un <img src={...}> dinámico nuevo no se vería en la app.
describe('guardia: las imágenes dinámicas usan ApiImage', () => {
  const sources = import.meta.glob(['../**/*.jsx', '!../**/*.test.jsx', '!./ApiImage.jsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  })

  it('ningún componente dibuja <img src={...}>', () => {
    const offenders = Object.entries(sources)
      .filter(([, code]) => /<img\b[^>]*\bsrc=\{/s.test(code))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
