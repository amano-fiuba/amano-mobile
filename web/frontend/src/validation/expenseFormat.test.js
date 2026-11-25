import { describe, expect, it } from 'vitest'
import { formatAmount, formatIsoDate } from './expenseFormat'

describe('formatAmount (009)', () => {
  it('formats the canonical amount with Argentine separators', () => {
    expect(formatAmount('0.01')).toBe('0,01')
    expect(formatAmount('250000.00')).toBe('250.000,00')
    expect(formatAmount('999999999.99')).toBe('999.999.999,99')
    expect(formatAmount('1234.5')).toBe('1.234,50')
    expect(formatAmount('12')).toBe('12,00')
  })

  it('returns unexpected values unchanged', () => {
    expect(formatAmount('abc')).toBe('abc')
    expect(formatAmount(undefined)).toBe('')
  })
})

describe('formatIsoDate (009)', () => {
  it('turns an ISO date into dd/mm/aaaa', () => {
    expect(formatIsoDate('2026-11-01')).toBe('01/11/2026')
  })

  it('returns unexpected values unchanged', () => {
    expect(formatIsoDate('01/11/2026')).toBe('01/11/2026')
    expect(formatIsoDate(null)).toBe('')
  })
})
