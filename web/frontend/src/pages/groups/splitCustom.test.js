import { describe, expect, it } from 'vitest'
import {
  CUSTOM_AMOUNT_INVALID,
  CUSTOM_SUM_INVALID,
  customShares,
  summarizeCustom,
} from './splitCustom'

const entries = (...pairs) => pairs.map(([key, amount]) => ({ key, amount }))
const amounts = (shares) => shares.map((share) => share.amount)

describe('summarizeCustom (022 T071)', () => {
  it('es válido cuando los importes suman exactamente el total', () => {
    const result = summarizeCustom('100.00', entries(['u:1', '33.33'], ['u:2', '33.33'], ['u:3', '33.34']))
    expect(result).toEqual({ ok: true, error: '', sumCents: 10000, differenceCents: 0 })
  })

  it('informa lo que falta (diferencia positiva) con el mensaje del backend', () => {
    const result = summarizeCustom('100.00', entries(['u:1', '30.00'], ['u:2', '60.00']))
    expect(result).toMatchObject({ ok: false, error: CUSTOM_SUM_INVALID, sumCents: 9000, differenceCents: 1000 })
  })

  it('informa lo que sobra (diferencia negativa)', () => {
    const result = summarizeCustom('0.05', entries(['u:1', '0.03'], ['s:4', '0.03']))
    expect(result).toMatchObject({ ok: false, error: CUSTOM_SUM_INVALID, differenceCents: -1 })
  })

  it('rechaza importes vacíos, en cero o inválidos antes que la suma', () => {
    expect(summarizeCustom('100.00', entries(['u:1', null], ['u:2', '100.00'])).error).toBe(CUSTOM_AMOUNT_INVALID)
    expect(summarizeCustom('100.00', entries(['u:1', '0.00'], ['u:2', '100.00'])).error).toBe(CUSTOM_AMOUNT_INVALID)
    expect(summarizeCustom('100.00', entries(['u:1', 'x'], ['u:2', '100.00'])).ok).toBe(false)
  })

  it('no es válido sin total o sin participantes', () => {
    expect(summarizeCustom(null, entries(['u:1', '1.00'])).ok).toBe(false)
    expect(summarizeCustom('10.00', []).ok).toBe(false)
    expect(summarizeCustom('10.00', undefined).error).toBe('')
  })
})

describe('customShares (022 T071)', () => {
  it('con la misma moneda las partes son exactamente los importes cargados', () => {
    const list = entries(['u:1', '3000.00'], ['u:2', '6000.00'], ['s:4', '1000.00'])
    const shares = customShares('10000.00', '10000.00', list, 'u:1')
    expect(shares.map((share) => share.key)).toEqual(['u:1', 'u:2', 's:4'])
    expect(amounts(shares)).toEqual(['3000.00', '6000.00', '1000.00'])
  })

  it('100,00 entre 3: los no pagadores no pagan de más y el pagador absorbe el resto', () => {
    const list = entries(['u:1', '33.33'], ['u:2', '33.33'], ['u:3', '33.34'])
    expect(amounts(customShares('100.00', '100.00', list, 'u:3'))).toEqual(['33.33', '33.33', '33.34'])
  })

  it('convierte el total una vez y reparte con piso al centavo (50,00 USD a 18,50)', () => {
    const list = entries(['u:1', '25.00'], ['u:2', '25.00'])
    expect(amounts(customShares('925.00', '50.00', list, 'u:1'))).toEqual(['462.50', '462.50'])
  })

  it('el pagador absorbe los centavos del redondeo y la suma es el total convertido', () => {
    const list = entries(['u:1', '0.01'], ['u:2', '0.01'], ['s:4', '0.01'])
    const shares = customShares('0.05', '0.03', list, 'u:1')
    expect(amounts(shares)).toEqual(['0.03', '0.01', '0.01'])
    expect(shares.reduce((sum, share) => sum + share.cents, 0)).toBe(5)
  })

  it('devuelve null con sumas que no cierran, sin pagador o sin total convertido', () => {
    const open = entries(['u:1', '10.00'], ['u:2', '10.00'])
    expect(customShares('100.00', '100.00', open, 'u:1')).toBeNull()
    expect(customShares('20.00', '20.00', open, 'u:9')).toBeNull()
    expect(customShares(null, '20.00', open, 'u:1')).toBeNull()
  })
})
