// Solo para pruebas: jsdom no decodifica imágenes ni tiene <canvas>. Simula una
// foto de `width`×`height` cuyo JPG pesa según la calidad y el tamaño pedidos.
import { vi } from 'vitest'

export function installFakeImageDecoder({ width = 4000, height = 3000, bytesPerPixel = 0.6 } = {}) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  )
  const realCreate = document.createElement.bind(document)
  const spy = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    if (tag !== 'canvas') return realCreate(tag, options)
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }),
      toBlob: (callback, type, quality) => {
        const size = Math.round(canvas.width * canvas.height * bytesPerPixel * quality)
        callback(new Blob([new Uint8Array(size)], { type }))
      },
    }
    return canvas
  })
  return () => {
    spy.mockRestore()
    vi.unstubAllGlobals()
  }
}
