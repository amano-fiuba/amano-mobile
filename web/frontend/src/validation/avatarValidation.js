// Reglas de avatar compartidas entre el registro (001, US3) y la edición del
// perfil (005). El MIME declarado del archivo es una pista, nunca la verdad:
// el contenido real se confirma con magic bytes (JPEG FF D8 FF / PNG 89 50 4E
// 47), la misma regla que aplica el backend. Viven en su propio módulo para
// cumplir react-refresh (los archivos de componentes solo exportan
// componentes).
export const FORMAT_MESSAGE = 'El archivo debe ser una imagen JPG o PNG válida'
export const SIZE_MESSAGE = 'El archivo es demasiado grande (máximo 2 MB)'

export async function realContentType(file) {
  // Solo los bytes iniciales: mismo criterio que el backend (AvatarValidator).
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'jpeg'
  }
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return 'png'
  }
  return null
}
