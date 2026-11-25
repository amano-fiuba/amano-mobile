// 022 T078 / 028: límites del plazo de pago del grupo compartidos con el modal
// de configuración de deudas y recordatorios.
export const MAX_DEBT_DUE_DAYS = 3650
export const DEBT_DUE_DAYS_INVALID =
  `Los días para el vencimiento tienen que ser un número entero entre 0 y ${MAX_DEBT_DUE_DAYS}`
export const DEBT_DUE_DAYS_REQUIRED = 'Indicá los días para el vencimiento de las deudas'

/** '' → null (nunca vence); '15' → 15; cualquier otra cosa → undefined (inválido). */
export function parseDueDays(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  if (!/^\d+$/.test(text)) return undefined
  const days = Number(text)
  return days <= MAX_DEBT_DUE_DAYS ? days : undefined
}
