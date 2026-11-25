// Display helpers for expenses returned by the API (feature 009). They work on
// the canonical strings of the contract ("250000.00", "2026-11-01") without ever
// converting to a floating-point number, like the parsers of expenseValidation.js.

/** "1234567.5" or "1234567.50" → "1.234.567,50"; anything unexpected is returned as-is. */
export function formatAmount(canonical) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(canonical ?? ''))
  if (!match) {
    return String(canonical ?? '')
  }
  const integer = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimals = (match[2] ?? '').padEnd(2, '0')
  return `${integer},${decimals}`
}

/** "2026-11-01" → "01/11/2026"; anything unexpected is returned as-is. */
export function formatIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso ?? '')
}
