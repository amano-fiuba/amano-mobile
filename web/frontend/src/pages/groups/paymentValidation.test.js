import { describe, expect, it } from 'vitest'
import {
  AMOUNT_DECIMALS,
  AMOUNT_FORMAT,
  AMOUNT_REQUIRED,
  DATE_FORMAT,
  DATE_FUTURE,
  DATE_INVALID,
  DATE_REQUIRED,
} from '../../validation/expenseValidation'
import {
  PAYMENT_BEFORE_EXPENSE,
  PAYMENT_EXCEEDS_OUTSTANDING,
  validatePaymentAmount,
  validatePaymentDate,
} from './paymentValidation'

// 018 T042: client rules of the payment form with the 007 messages.

describe('validatePaymentAmount (018)', () => {
  it('usa los mensajes de 007', () => {
    expect(validatePaymentAmount('', '100.00')).toBe(AMOUNT_REQUIRED)
    expect(validatePaymentAmount('abc', '100.00')).toBe(AMOUNT_FORMAT)
    expect(validatePaymentAmount('1,234', '100.00')).toBe(AMOUNT_DECIMALS)
    expect(validatePaymentAmount('0', '100.00')).not.toBe(true)
  })

  it('no permite superar el saldo', () => {
    expect(validatePaymentAmount('2.333,34', '2333.33')).toBe(
      'El pago no puede superar el saldo de $ 2.333,33',
    )
    expect(PAYMENT_EXCEEDS_OUTSTANDING('2333.33')).toBe('El pago no puede superar el saldo de $ 2.333,33')
  })

  it('acepta un parcial o el saldo exacto', () => {
    expect(validatePaymentAmount('1.000', '2333.33')).toBe(true)
    expect(validatePaymentAmount('2.333,33', '2333.33')).toBe(true)
  })

  it('sin saldo conocido solo valida el formato', () => {
    expect(validatePaymentAmount('50', undefined)).toBe(true)
  })
})

describe('validatePaymentDate (018)', () => {
  const today = '2026-11-05'
  const expenseDate = '2026-11-01'

  it('usa los mensajes de 007', () => {
    expect(validatePaymentDate('', today, expenseDate)).toBe(DATE_REQUIRED)
    expect(validatePaymentDate('2026-11-05', today, expenseDate)).toBe(DATE_FORMAT)
    expect(validatePaymentDate('31/02/2026', today, expenseDate)).toBe(DATE_INVALID)
    expect(validatePaymentDate('06/11/2026', today, expenseDate)).toBe(DATE_FUTURE)
  })

  it('no puede ser anterior a la fecha del gasto', () => {
    expect(validatePaymentDate('31/10/2026', today, expenseDate)).toBe(PAYMENT_BEFORE_EXPENSE)
  })

  it('acepta desde el día del gasto hasta hoy', () => {
    expect(validatePaymentDate('01/11/2026', today, expenseDate)).toBe(true)
    expect(validatePaymentDate('05/11/2026', today, expenseDate)).toBe(true)
    expect(validatePaymentDate('05/11/2026', null, null)).toBe(true)
  })
})
