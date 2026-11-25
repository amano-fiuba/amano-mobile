import { describe, expect, it } from 'vitest'
import {
  PERCENTAGE_INVALID,
  PERCENTAGE_SUM_INVALID,
  formatPercentage,
  parsePercentage,
  percentageShares,
  summarizePercentages,
} from './splitPercentage'

const entries = (...pairs) => pairs.map(([key, percentage]) => ({ key, percentage }))
const amounts = (shares) => shares.map((share) => share.amount)

describe('parsePercentage / formatPercentage (022 T071)', () => {
  it('acepta coma o punto con hasta dos decimales y devuelve centésimas y texto canónico', () => {
    expect(parsePercentage('33,33')).toEqual({ ok: true, hundredths: 3333, canonical: '33.33' })
    expect(parsePercentage(' 50 ')).toEqual({ ok: true, hundredths: 5000, canonical: '50' })
    expect(parsePercentage('0,5')).toEqual({ ok: true, hundredths: 50, canonical: '0.5' })
    expect(parsePercentage('007.10')).toMatchObject({ ok: true, canonical: '7.10' })
    expect(parsePercentage('100')).toMatchObject({ ok: true, hundredths: 10000 })
  })

  it('rechaza cero, vacío, texto, más de dos decimales y más de 100', () => {
    for (const raw of ['0', '0,00', '', null, 'abc', '1,234', '100,01', '-5', '1e2']) {
      expect(parsePercentage(raw).ok).toBe(false)
    }
  })

  it('formatea sin ceros de más', () => {
    expect(formatPercentage(3333)).toBe('33,33')
    expect(formatPercentage(5000)).toBe('50')
    expect(formatPercentage(50)).toBe('0,5')
    expect(formatPercentage(-250)).toBe('2,5')
  })
})

describe('summarizePercentages (022 T071)', () => {
  it('es válido cuando suman exactamente 100', () => {
    const result = summarizePercentages(entries(['u:1', '33,33'], ['u:2', '33.33'], ['s:4', '33,34']))
    expect(result).toEqual({ ok: true, error: '', sumHundredths: 10000, differenceHundredths: 0 })
  })

  it('informa lo que falta y lo que sobra con el mensaje del backend', () => {
    expect(summarizePercentages(entries(['u:1', '30'], ['u:2', '60'])))
      .toMatchObject({ ok: false, error: PERCENTAGE_SUM_INVALID, differenceHundredths: 1000 })
    expect(summarizePercentages(entries(['u:1', '60'], ['u:2', '50'])))
      .toMatchObject({ ok: false, error: PERCENTAGE_SUM_INVALID, differenceHundredths: -1000 })
  })

  it('un porcentaje vacío o en cero invalida antes que la suma', () => {
    expect(summarizePercentages(entries(['u:1', ''], ['u:2', '100'])).error).toBe(PERCENTAGE_INVALID)
    expect(summarizePercentages(entries(['u:1', '0'], ['u:2', '100'])).error).toBe(PERCENTAGE_INVALID)
  })

  it('sin participantes no es válido', () => {
    expect(summarizePercentages([]).ok).toBe(false)
  })
})

describe('percentageShares (022 T071)', () => {
  it('100,00 entre 3 con 33,33 / 33,33 / 33,34: el pagador absorbe el centavo', () => {
    const list = entries(['u:1', '33,33'], ['u:2', '33,33'], ['u:3', '33,34'])
    expect(amounts(percentageShares('100.00', list, 'u:3'))).toEqual(['33.33', '33.33', '33.34'])
  })

  it('0,05 entre 3: 0,01 / 0,01 / 0,03 (el pagador absorbe los dos centavos)', () => {
    const list = entries(['u:1', '33,33'], ['u:2', '33,33'], ['s:4', '33,34'])
    const shares = percentageShares('0.05', list, 'u:1')
    expect(amounts(shares)).toEqual(['0.03', '0.01', '0.01'])
  })

  it('una persona simulada puede llevar su propio porcentaje', () => {
    const list = entries(['u:7', '50'], ['s:4', '25'], ['u:15', '25'])
    const shares = percentageShares('1000.00', list, 'u:7')
    expect(shares.map((share) => share.key)).toEqual(['u:7', 's:4', 'u:15'])
    expect(amounts(shares)).toEqual(['500.00', '250.00', '250.00'])
  })

  it('la suma de las partes es siempre el total, sin pagarle de más a un no pagador', () => {
    const list = entries(['u:1', '12,5'], ['u:2', '37,5'], ['u:3', '50'])
    const shares = percentageShares('99.99', list, 'u:3')
    expect(shares.reduce((sum, share) => sum + share.cents, 0)).toBe(9999)
    expect(shares[0].cents).toBe(1249) // floor(9999 * 12,5 %)
    expect(shares[1].cents).toBe(3749)
  })

  it('devuelve null con sumas que no cierran, sin pagador o sin total', () => {
    expect(percentageShares('100.00', entries(['u:1', '40'], ['u:2', '40']), 'u:1')).toBeNull()
    expect(percentageShares('100.00', entries(['u:1', '50'], ['u:2', '50']), 'u:9')).toBeNull()
    expect(percentageShares(null, entries(['u:1', '50'], ['u:2', '50']), 'u:1')).toBeNull()
  })
})
