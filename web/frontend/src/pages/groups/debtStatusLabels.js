import { formatAmount } from '../../validation/expenseFormat'

// Spanish labels of the debt states (specs/017-debt-states, data-model.md
// §Estados de deuda, FR-023; extended by 022 D3). The CSS modifier is exported
// too so the badge and its tests agree on one mapping. The UI never shows the
// enum value.
//   Open (still count in the balances): PENDING, PARTIALLY_PAID, PAYMENT_REPORTED, OVERDUE.
//   Settled: PAID and VERIFIED. PAYMENT_REPORTED is NOT settled until an admin confirms.
//   Payable (a new partial or total payment can be registered): PENDING, PARTIALLY_PAID, OVERDUE.

export const DEBT_STATUS_UNKNOWN = 'Estado desconocido'

const MODIFIERS = {
  PENDING: 'pending',
  PARTIALLY_PAID: 'partial',
  PAYMENT_REPORTED: 'reported',
  PAID: 'paid',
  VERIFIED: 'verified',
  OVERDUE: 'overdue',
}

const OPEN = ['PENDING', 'PARTIALLY_PAID', 'PAYMENT_REPORTED', 'OVERDUE']
const SETTLED = ['PAID', 'VERIFIED']
const PAYABLE = ['PENDING', 'PARTIALLY_PAID', 'OVERDUE']

/**
 * "Pendiente", "Pago parcial · faltan $ 1.234,50" (or "Pago parcial" when no
 * outstanding balance is supplied), "Pago informado", "Pagada", "Pago verificado",
 * "Vencida" or the unknown label.
 */
export function debtStatusLabel(status, outstanding) {
  switch (status) {
    case 'PENDING':
      return 'Pendiente'
    case 'PARTIALLY_PAID':
      return outstanding == null || outstanding === ''
        ? 'Pago parcial'
        : `Pago parcial · faltan $ ${formatAmount(outstanding)}`
    case 'PAYMENT_REPORTED':
      return 'Pago informado'
    case 'PAID':
      return 'Pagada'
    case 'VERIFIED':
      return 'Pago verificado'
    case 'OVERDUE':
      return 'Vencida'
    default:
      return DEBT_STATUS_UNKNOWN
  }
}

/** BEM modifier of `.group-expense__status`, or "unknown". */
export function debtStatusModifier(status) {
  return MODIFIERS[status] ?? 'unknown'
}

/** True while the debt still counts in the balances (PAYMENT_REPORTED included). */
export function isOpenDebtStatus(status) {
  return OPEN.includes(status)
}

/** True for PAID and VERIFIED only: PAYMENT_REPORTED is not settled. */
export function isSettledDebtStatus(status) {
  return SETTLED.includes(status)
}

/** True when a new partial or total payment can be registered (OVERDUE debts can be paid). */
export function isPayableDebtStatus(status) {
  return PAYABLE.includes(status)
}
