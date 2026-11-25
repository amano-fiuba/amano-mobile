// PERCENTAGE split of a group expense (specs/022-group-debt-management,
// contracts/expense-split-and-edit.md §1; T071). Mirrors ExpenseSplit.percentage:
// each percentage is > 0, they sum to exactly 100, every non-payer receives
// floor(total * percentage / 100) in cents and the payer absorbs the remainder.
// Percentages are kept in hundredths of a percent (33,33 % → 3333) so the sum is
// an exact integer; the typed text accepts up to two decimals, comma or dot.

import { fromCents, toCents } from './splitEqually'

export const PERCENTAGE_INVALID = 'Cada porcentaje tiene que ser mayor que 0'
export const PERCENTAGE_SUM_INVALID = 'Los porcentajes deben sumar exactamente 100'

const FULL = 10000 // 100 % in hundredths
const TYPED = /^(\d{1,3})(?:[.,](\d{1,2}))?$/

/**
 * "33,33" / "33.3" / "100" → { ok, hundredths, canonical } ("33.33"); anything
 * else, 0 or above 100 → { ok: false }.
 */
export function parsePercentage(raw) {
  const match = TYPED.exec(String(raw ?? '').trim())
  if (!match) {
    return { ok: false, hundredths: null, canonical: null }
  }
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  if (hundredths <= 0 || hundredths > FULL) {
    return { ok: false, hundredths: null, canonical: null }
  }
  const canonical = `${match[1].replace(/^0+(?=\d)/, '')}${match[2] ? `.${match[2]}` : ''}`
  return { ok: true, hundredths, canonical }
}

/** 3333 → "33,33"; 5000 → "50"; 50 → "0,5". */
export function formatPercentage(hundredths) {
  const abs = Math.abs(hundredths)
  const fraction = String(abs % 100).padStart(2, '0').replace(/0+$/, '')
  return `${Math.floor(abs / 100)}${fraction ? `,${fraction}` : ''}`
}

/**
 * `entries`: [{ key, percentage }] with the typed text. Returns
 * `{ ok, error, sumHundredths, differenceHundredths }` (100 % − sum: positive
 * still missing, negative over). `error` is '' when ok.
 */
export function summarizePercentages(entries) {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) {
    return { ok: false, error: '', sumHundredths: 0, differenceHundredths: FULL }
  }
  let sumHundredths = 0
  let invalid = false
  for (const entry of list) {
    const parsed = parsePercentage(entry?.percentage)
    if (parsed.ok) {
      sumHundredths += parsed.hundredths
    } else {
      invalid = true
    }
  }
  const differenceHundredths = FULL - sumHundredths
  if (invalid) {
    return { ok: false, error: PERCENTAGE_INVALID, sumHundredths, differenceHundredths }
  }
  if (differenceHundredths !== 0) {
    return { ok: false, error: PERCENTAGE_SUM_INVALID, sumHundredths, differenceHundredths }
  }
  return { ok: true, error: '', sumHundredths, differenceHundredths: 0 }
}

/**
 * Estimated shares of `totalCanonical` (group currency): `[{ key, cents, amount }]`
 * in the order of `entries`, or null while the split is not valid, the total is
 * unknown or the payer is not among the entries.
 */
export function percentageShares(totalCanonical, entries, payerKey) {
  const total = toCents(totalCanonical)
  const payerIndex = Array.isArray(entries) ? entries.findIndex((entry) => entry.key === payerKey) : -1
  if (total === null || payerIndex < 0 || !summarizePercentages(entries).ok) {
    return null
  }
  const shares = entries.map((entry) => {
    if (entry.key === payerKey) {
      return { key: entry.key, cents: 0 }
    }
    const { hundredths } = parsePercentage(entry.percentage)
    return { key: entry.key, cents: Number((BigInt(total) * BigInt(hundredths)) / BigInt(FULL)) }
  })
  const others = shares.reduce((sum, share) => sum + share.cents, 0)
  shares[payerIndex].cents = total - others
  return shares.map((share) => ({ ...share, amount: fromCents(share.cents) }))
}
