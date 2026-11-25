// Estimated converted amount for the expense form preview (022 T070). Money never
// goes through floating point arithmetic in this app: the canonical amount
// ("1234.56") and the rate (scale 8, as the backend rounds it) are multiplied as
// integers and rounded HALF_UP to the cent, like the server does when saving.

const RATE_SCALE = 8
const RATE_FACTOR = 10n ** BigInt(RATE_SCALE)

/**
 * "100.00" × 1250.5 → "125050.00". Returns null when the amount or the rate are
 * not usable (so the caller can show the "could not quote" message).
 */
export function convertAmount(canonicalAmount, rate) {
  const amount = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(canonicalAmount ?? ''))
  const numericRate = Number(rate)
  if (!amount || !Number.isFinite(numericRate) || numericRate <= 0 || numericRate >= 1e12) {
    return null
  }
  const cents = BigInt(amount[1] + (amount[2] ?? '').padEnd(2, '0'))
  const [integer, fraction = ''] = numericRate.toFixed(RATE_SCALE).split('.')
  const scaledRate = BigInt(integer + fraction.padEnd(RATE_SCALE, '0'))
  const product = cents * scaledRate
  const converted = (product + RATE_FACTOR / 2n) / RATE_FACTOR
  const digits = converted.toString().padStart(3, '0')
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`
}
