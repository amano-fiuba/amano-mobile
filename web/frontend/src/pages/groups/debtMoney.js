// Money shown by the debts screen (022 T074). The read endpoints send BigDecimal
// as JSON numbers with at most two decimals; this turns them into the canonical
// text ("3333.33") the rest of the app formats and the payment endpoint expects,
// without doing any arithmetic on them.

/** 3333.3 → "3333.33"; "50.00" → "50.00"; anything unusable → null. */
export function moneyText(value) {
  if (typeof value === 'string' && /^\d+\.\d{2}$/.test(value)) return value
  const number = Number(value)
  if (value === null || value === undefined || value === '' || !Number.isFinite(number)) return null
  return Math.abs(number).toFixed(2)
}

/** -1500 → -1, 0 → 0, 20 → 1 (sign of a balance, 0 for unusable values). */
export function moneySign(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 0
  return number > 0 ? 1 : -1
}
