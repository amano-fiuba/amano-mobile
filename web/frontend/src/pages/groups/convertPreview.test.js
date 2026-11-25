import { describe, expect, it } from 'vitest'
import { convertAmount } from './convertPreview'

describe('convertAmount (022 T070)', () => {
  it('multiplica el monto canónico por la cotización y devuelve centavos exactos', () => {
    expect(convertAmount('100.00', 1250.5)).toBe('125050.00')
    expect(convertAmount('10.50', '1250.50000000')).toBe('13130.25')
  })

  it('redondea hacia arriba en el medio centavo, como el servidor (HALF_UP)', () => {
    expect(convertAmount('0.01', 0.5)).toBe('0.01')
    expect(convertAmount('0.01', 0.49999999)).toBe('0.00')
    expect(convertAmount('1.00', 0.125)).toBe('0.13')
  })

  it('no pierde precisión con importes grandes ni con cotizaciones chicas', () => {
    expect(convertAmount('9999999.99', 1)).toBe('9999999.99')
    expect(convertAmount('1000.00', 0.0008)).toBe('0.80')
    expect(convertAmount('5', 2)).toBe('10.00')
  })

  it('devuelve null con montos o cotizaciones inutilizables', () => {
    expect(convertAmount('abc', 2)).toBeNull()
    expect(convertAmount(null, 2)).toBeNull()
    expect(convertAmount('10.00', 'x')).toBeNull()
    expect(convertAmount('10.00', 0)).toBeNull()
    expect(convertAmount('10.00', -1)).toBeNull()
    expect(convertAmount('10.00', undefined)).toBeNull()
  })
})
