import { afterEach, describe, expect, it } from 'vitest'
import {
  INPUT_MAX_BYTES,
  INPUT_SIZE_MESSAGE,
  MAX_DIMENSION,
  UNREADABLE_MESSAGE,
  UPLOAD_MAX_BYTES,
  prepareImageForUpload,
} from './imagePrep'
import { installFakeImageDecoder } from './fakeImageDecoder'

function fileWith(head, size, name = 'foto.jpg', type = 'image/jpeg') {
  const bytes = new Uint8Array(size)
  bytes.set(head, 0)
  return new File([bytes], name, { type })
}

const JPEG = [0xff, 0xd8, 0xff]
const PNG = [0x89, 0x50, 0x4e, 0x47]

let restore = () => {}
afterEach(() => restore())

describe('prepareImageForUpload (foto de perfil y de grupo)', () => {
  it('un JPG o PNG de 2 MB o menos se sube tal cual', async () => {
    const file = fileWith(PNG, 1000, 'yo.png', 'image/png')
    const result = await prepareImageForUpload(file)
    expect(result).toEqual({ ok: true, file, resized: false })
  })

  it('una foto pesada se achica a un JPG de 2 MB o menos', async () => {
    restore = installFakeImageDecoder({ width: 4000, height: 3000 })
    const file = fileWith(JPEG, 9 * 1024 * 1024, 'IMG_2041.jpeg')

    const result = await prepareImageForUpload(file)

    expect(result.ok).toBe(true)
    expect(result.resized).toBe(true)
    expect(result.file.type).toBe('image/jpeg')
    expect(result.file.name).toBe('IMG_2041.jpg')
    expect(result.file.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)
  })

  it('acepta formatos que el navegador abre aunque no sean JPG/PNG (WebP)', async () => {
    restore = installFakeImageDecoder({ width: 800, height: 600 })
    const webp = fileWith([0x52, 0x49, 0x46, 0x46], 300, 'perfil.webp', 'image/webp')

    const result = await prepareImageForUpload(webp)

    expect(result.ok).toBe(true)
    expect(result.file.name).toBe('perfil.jpg')
  })

  it('reduce el lado mayor a 1280 px', async () => {
    let drawn
    restore = installFakeImageDecoder({ width: 6000, height: 2000, bytesPerPixel: 0.1 })
    const original = document.createElement
    document.createElement = (tag, options) => {
      const element = original.call(document, tag, options)
      if (tag === 'canvas') drawn = element
      return element
    }
    try {
      await prepareImageForUpload(fileWith(JPEG, 5 * 1024 * 1024))
    } finally {
      document.createElement = original
    }
    expect(drawn.width).toBe(MAX_DIMENSION)
    expect(drawn.height).toBe(Math.round((2000 * MAX_DIMENSION) / 6000))
  })

  it('si ni achicando entra en 2 MB, achica también las dimensiones', async () => {
    restore = installFakeImageDecoder({ width: 4000, height: 4000, bytesPerPixel: 4 })
    const result = await prepareImageForUpload(fileWith(JPEG, 8 * 1024 * 1024))
    expect(result.ok).toBe(true)
    expect(result.file.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES)
  })

  it('más de 25 MB → mensaje de tamaño', async () => {
    const result = await prepareImageForUpload(fileWith(JPEG, INPUT_MAX_BYTES + 1))
    expect(result).toEqual({ ok: false, message: INPUT_SIZE_MESSAGE })
  })

  it('un archivo que no es imagen → mensaje de formato de siempre', async () => {
    const text = new File(['hola'], 'nota.txt', { type: 'text/plain' })
    const result = await prepareImageForUpload(text)
    expect(result).toEqual({
      ok: false,
      message: 'El archivo debe ser una imagen JPG o PNG válida',
    })
  })

  it('un JPG pesado que no se puede abrir → mensaje específico', async () => {
    // jsdom no decodifica: simula un archivo dañado.
    const result = await prepareImageForUpload(fileWith(JPEG, UPLOAD_MAX_BYTES + 1))
    expect(result).toEqual({ ok: false, message: UNREADABLE_MESSAGE })
  })

  it('sin archivo no hay mensaje', async () => {
    expect(await prepareImageForUpload(null)).toEqual({ ok: false, message: '' })
  })
})
