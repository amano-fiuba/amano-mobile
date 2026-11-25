import { fromCents, toCents } from './splitEqually'

// State a debt would reach after a payment (specs/018-register-payment, plan.md
// §Módulos sin interfaz, FR-018). Works in whole cents like splitEqually and
// follows the backend DebtStatus.of: no balance left → PAID, otherwise
// PARTIALLY_PAID. Returns null when the payment is not valid for the debt
// (not canonical, ≤ 0 or above the outstanding balance).
export function previewPayment(debt, amountCanonical) {
  const outstanding = toCents(debt?.outstanding)
  const paid = toCents(debt?.paidAmount)
  const payment = toCents(amountCanonical)
  if (outstanding === null || paid === null || payment === null) {
    return null
  }
  if (payment <= 0 || payment > outstanding) {
    return null
  }
  const left = outstanding - payment
  return {
    status: left === 0 ? 'PAID' : 'PARTIALLY_PAID',
    paidAmount: fromCents(paid + payment),
    outstanding: fromCents(left),
  }
}
