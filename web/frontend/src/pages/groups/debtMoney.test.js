import { describe, expect, it } from 'vitest'
import { moneySign, moneyText } from './debtMoney'

describe('moneyText / moneySign (022 T074)', () => {
  it('lleva números y textos a la forma canónica de dos decimales', () => {
    expect(moneyText(3333.33)).toBe('3333.33')
    expect(moneyText(50)).toBe('50.00')
    expect(moneyText(0.1)).toBe('0.10')
    expect(moneyText('50.00')).toBe('50.00')
    expect(moneyText('12.5')).toBe('12.50')
  })

  it('usa el valor absoluto y rechaza lo que no es un monto', () => {
    expect(moneyText(-1500)).toBe('1500.00')
    for (const bad of [null, undefined, '', 'abc', NaN]) {
      expect(moneyText(bad)).toBeNull()
    }
  })

  it('el signo distingue a quien debe, a quien cobra y a quien está al día', () => {
    expect(moneySign(20)).toBe(1)
    expect(moneySign(-1500.5)).toBe(-1)
    expect(moneySign(0)).toBe(0)
    expect(moneySign('x')).toBe(0)
  })
})
