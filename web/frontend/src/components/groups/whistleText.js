// 030: pure texts of "Avisar" (kept apart from the component for Fast Refresh).

export function whistleSuccessMessage(name) {
  return `Le avisamos a ${name}`
}

/**
 * Remaining wait of a 429 in voseo-friendly units, always rounded UP to the
 * minute: 63600 s → "17 h 40 min", 7200 s → "2 h", 59 s → "1 min". Without a
 * value it falls back to the whole window.
 */
export function formatWait(seconds) {
  const value = seconds == null ? NaN : Number(seconds)
  if (!Number.isFinite(value)) return '24 h'
  const minutes = Math.max(1, Math.ceil(value / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
