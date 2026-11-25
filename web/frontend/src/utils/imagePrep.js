// Preparación de fotos antes de subirlas (avatar de perfil, avatar del
// registro y foto de grupo).
//
// El backend sigue aceptando hasta 2 MB en JPG o PNG (AvatarValidator, sin
// cambios). Las fotos de un celular suelen pesar 4 a 15 MB, así que el
// navegador las achica antes de enviarlas: se aceptan archivos de hasta 25 MB
// en cualquier formato que el navegador sepa abrir (JPG, PNG, WebP, HEIC en los
// equipos que lo soportan) y se suben como JPG de hasta 1280 px por lado.
//
// Si el archivo ya es un JPG o PNG de 2 MB o menos se sube tal cual (se
// conserva la transparencia de los PNG).
import { FORMAT_MESSAGE, realContentType } from '../validation/avatarValidation'

export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024
export const INPUT_MAX_BYTES = 25 * 1024 * 1024
export const MAX_DIMENSION = 1280

export const INPUT_SIZE_MESSAGE = 'La imagen es demasiado grande (máximo 25 MB)'
export const UNREADABLE_MESSAGE =
  'No se pudo abrir la imagen. Probá con una foto JPG o PNG'

const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45]

/**
 * Devuelve `{ ok: true, file, resized }` con un archivo listo para subir, o
 * `{ ok: false, message }` con el texto a mostrar.
 */
export async function prepareImageForUpload(
  file,
  { maxBytes = UPLOAD_MAX_BYTES, maxDimension = MAX_DIMENSION } = {},
) {
  if (!file) {
    return { ok: false, message: '' }
  }
  if (file.size > INPUT_MAX_BYTES) {
    return { ok: false, message: INPUT_SIZE_MESSAGE }
  }
  const kind = await realContentType(file).catch(() => null)
  if (kind && file.size <= maxBytes) {
    return { ok: true, file, resized: false }
  }

  try {
    const blob = await shrink(file, maxBytes, maxDimension)
    const name = `${(file.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`
    return {
      ok: true,
      file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
      resized: true,
    }
  } catch {
    // Sin poder abrirla: si ni siquiera es JPG/PNG, el mensaje de formato de
    // siempre; si lo es (por ejemplo, un archivo dañado), uno específico.
    return { ok: false, message: kind ? UNREADABLE_MESSAGE : FORMAT_MESSAGE }
  }
}

async function shrink(file, maxBytes, maxDimension) {
  const source = await decode(file)
  try {
    let dimension = maxDimension
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const canvas = draw(source, dimension)
      for (const quality of QUALITIES) {
        const blob = await toJpeg(canvas, quality)
        if (blob.size <= maxBytes) {
          return blob
        }
      }
      dimension = Math.round(dimension * 0.7)
    }
    throw new Error('too-large')
  } finally {
    source.close?.()
  }
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // Respeta la orientación EXIF de las fotos de cámara.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // algunos WebView no aceptan opciones: se reintenta con <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function draw(source, maxDimension) {
  const width = source.width || source.naturalWidth
  const height = source.height || source.naturalHeight
  if (!width || !height) {
    throw new Error('empty')
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('no-canvas')
  }
  // Fondo blanco: un PNG con transparencia no queda negro al pasar a JPG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

function toJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode'))),
      'image/jpeg',
      quality,
    )
  })
}
