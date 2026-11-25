// Equal split of a group expense in whole cents (specs/017-debt-states,
// research.md D4, FR-005/FR-022). Mirrors the backend EqualSplit so the preview
// of the form shows exactly the shares the server will store:
//   base = total / n, rest = total mod n
//   - payer participates → every share is `base`, the payer's is `base + rest`;
//   - payer does not participate → the first `rest` participants (request
//     order) get `base + 1`, the others `base`.
// Amounts are canonical strings ("10000.00"); the maximum (999.999.999,99 →
// 99.999.999.999 cents) fits in a Number without precision loss.

const CANONICAL = /^(\d+)\.(\d{2})$/

/** "10000.00" → 1000000 cents, or null when it is not a canonical amount. */
export function toCents(canonical) {
  const match = CANONICAL.exec(String(canonical ?? ''))
  if (!match) {
    return null
  }
  return Number(match[1]) * 100 + Number(match[2])
}

/** 1000000 → "10000.00". */
export function fromCents(cents) {
  const integer = Math.floor(cents / 100)
  const fraction = String(cents % 100).padStart(2, '0')
  return `${integer}.${fraction}`
}

/**
 * Returns one `{ key, cents, amount }` per participant key, in the given order,
 * or null when the amount is not valid, there are no participants or the total
 * does not reach one cent per participant (base = 0, FR-006).
 */
export function splitEqually(amountCanonical, participantKeys, payerKey) {
  const total = toCents(amountCanonical)
  const keys = Array.isArray(participantKeys) ? participantKeys : []
  const n = keys.length
  if (total === null || total <= 0 || n === 0) {
    return null
  }
  const base = Math.floor(total / n)
  if (base === 0) {
    return null
  }
  const rest = total % n
  const payerIndex = keys.indexOf(payerKey)

  return keys.map((key, index) => {
    let cents = base
    if (payerIndex >= 0) {
      if (index === payerIndex) {
        cents += rest
      }
    } else if (index < rest) {
      cents += 1
    }
    return { key, cents, amount: fromCents(cents) }
  })
}
