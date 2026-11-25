import { describe, expect, it } from 'vitest'
import { previewPayment } from './paymentPreview'

// 018 T041: state a debt reaches after a payment (same rule as DebtStatus.of).

const DEBT = { amount: '3333.33', paidAmount: '1000.00', outstanding: '2333.33' }

describe('previewPayment (018)', () => {
  it('un pago parcial deja la deuda con pago parcial y el saldo restante', () => {
    expect(previewPayment(DEBT, '333.33')).toEqual({
      status: 'PARTIALLY_PAID',
      paidAmount: '1333.33',
      outstanding: '2000.00',
    })
  })

  it('el saldo exacto deja la deuda pagada', () => {
    expect(previewPayment(DEBT, '2333.33')).toEqual({
      status: 'PAID',
      paidAmount: '3333.33',
      outstanding: '0.00',
    })
  })

  it('el último centavo también la deja pagada', () => {
    expect(previewPayment({ amount: '0.01', paidAmount: '0.00', outstanding: '0.01' }, '0.01'))
      .toMatchObject({ status: 'PAID', outstanding: '0.00' })
  })

  it('un monto mayor al saldo, cero o no canónico no tiene vista previa', () => {
    expect(previewPayment(DEBT, '2333.34')).toBeNull()
    expect(previewPayment(DEBT, '0.00')).toBeNull()
    expect(previewPayment(DEBT, '12,50')).toBeNull()
    expect(previewPayment(DEBT, null)).toBeNull()
  })

  it('sin deuda o con montos inválidos en la deuda devuelve null', () => {
    expect(previewPayment(null, '1.00')).toBeNull()
    expect(previewPayment({ ...DEBT, paidAmount: undefined }, '1.00')).toBeNull()
  })
})
