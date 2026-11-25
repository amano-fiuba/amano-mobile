// CUSTOM split of a group expense (specs/022-group-debt-management, contracts/
// expense-split-and-edit.md §1; T071). Mirrors the backend ExpenseSplit.custom:
//   - the amounts are typed in the ORIGINAL currency of the expense and must sum
//     exactly to the original total;
//   - each non-payer receives floor(convertedTotal * amount_i / originalTotal) in
//     cents and the payer absorbs the remainder (so the sum is the converted total).
// Same currency (converted == original): the parts are exactly the typed amounts.
// Amounts are canonical strings ("3000.00") or null when not valid; the products
// go through BigInt, never floating point.

import { fromCents, toCents } from './splitEqually'

// Same texts as the backend (GroupExpenseService), so the form speaks like the API.
export const CUSTOM_AMOUNT_INVALID = 'Cada importe personalizado tiene que ser mayor que 0'
export const CUSTOM_SUM_INVALID =
  'Los importes personalizados deben sumar exactamente el total del gasto'

/**
 * `entries`: [{ key, amount }] (canonical amount or null). Returns
 * `{ ok, error, sumCents, differenceCents }`; `differenceCents` is total - sum
 * (positive: still missing, negative: over). `error` is '' when ok.
 */
export function summarizeCustom(totalCanonical, entries) {
  const total = toCents(totalCanonical)
  const list = Array.isArray(entries) ? entries : []
  if (total === null || total <= 0 || list.length === 0) {
    return { ok: false, error: '', sumCents: 0, differenceCents: 0 }
  }
  let sumCents = 0
  let invalid = false
  for (const entry of list) {
    const cents = toCents(entry?.amount)
    if (cents === null || cents <= 0) {
      invalid = true
    } else {
      sumCents += cents
    }
  }
  const differenceCents = total - sumCents
  if (invalid) {
    return { ok: false, error: CUSTOM_AMOUNT_INVALID, sumCents, differenceCents }
  }
  if (differenceCents !== 0) {
    return { ok: false, error: CUSTOM_SUM_INVALID, sumCents, differenceCents }
  }
  return { ok: true, error: '', sumCents, differenceCents: 0 }
}

/**
 * Estimated shares in the group currency: `[{ key, cents, amount }]` in the order
 * of `entries`, or null while the split is not valid, the payer is not among the
 * entries or the converted total is unknown.
 */
export function customShares(convertedTotal, originalTotal, entries, payerKey) {
  const converted = toCents(convertedTotal)
  const original = toCents(originalTotal)
  const payerIndex = Array.isArray(entries) ? entries.findIndex((entry) => entry.key === payerKey) : -1
  if (converted === null || original === null || payerIndex < 0) {
    return null
  }
  if (!summarizeCustom(originalTotal, entries).ok) {
    return null
  }
  const shares = entries.map((entry) => {
    if (entry.key === payerKey) {
      return { key: entry.key, cents: 0 }
    }
    const cents = Number((BigInt(converted) * BigInt(toCents(entry.amount))) / BigInt(original))
    return { key: entry.key, cents }
  })
  const others = shares.reduce((sum, share) => sum + share.cents, 0)
  shares[payerIndex].cents = converted - others
  return shares.map((share) => ({ ...share, amount: fromCents(share.cents) }))
}
