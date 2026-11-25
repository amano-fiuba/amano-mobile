import { formatAmount } from '../../validation/expenseFormat'
import { DATE_FUTURE, parseArgentineAmount, parseArgentineDate } from '../../validation/expenseValidation'
import { toCents } from './splitEqually'

// Client-side rules of the payment form (specs/018-register-payment, plan.md D4,
// FR-019). Amount and date reuse the 007 parsers and messages; the balance cap
// and the minimum date use the same texts as the backend contract.

export const PAYMENT_BEFORE_EXPENSE = 'La fecha del pago no puede ser anterior a la del gasto'

/** "El pago no puede superar el saldo de $ 2.333,33" for the canonical outstanding. */
export function PAYMENT_EXCEEDS_OUTSTANDING(outstanding) {
  return `El pago no puede superar el saldo de $ ${formatAmount(outstanding)}`
}

/** `true` or the error of an amount typed in the Argentine format, against the debt balance. */
export function validatePaymentAmount(raw, outstanding) {
  const parsed = parseArgentineAmount(raw)
  if (!parsed.ok) {
    return parsed.error
  }
  const limit = toCents(outstanding)
  if (limit !== null && toCents(parsed.canonical) > limit) {
    return PAYMENT_EXCEEDS_OUTSTANDING(outstanding)
  }
  return true
}

/**
 * `true` or the error of a dd/mm/aaaa date: valid (007), not after today and not
 * before the expense date. ISO dates compare as text.
 */
export function validatePaymentDate(raw, todayIso, expenseDateIso) {
  const parsed = parseArgentineDate(raw)
  if (!parsed.ok) {
    return parsed.error
  }
  if (todayIso && parsed.iso > todayIso) {
    return DATE_FUTURE
  }
  if (expenseDateIso && parsed.iso < expenseDateIso) {
    return PAYMENT_BEFORE_EXPENSE
  }
  return true
}
