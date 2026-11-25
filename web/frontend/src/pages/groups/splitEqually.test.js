import { describe, expect, it } from 'vitest'
import { fromCents, splitEqually, toCents } from './splitEqually'

// 017 T031: same cases as the backend EqualSplitTest (research.md D4), so the
// preview of the form always matches the shares the server stores.

const keys = (n) => Array.from({ length: n }, (_, index) => `k${index}`)
const amounts = (total, n, payerIndex) =>
  splitEqually(total, keys(n), payerIndex >= 0 ? `k${payerIndex}` : 'nobody').map((share) => share.amount)

describe('splitEqually (017)', () => {
  it('una división exacta da la misma parte a todos', () => {
    expect(amounts('100.00', 2, 0)).toEqual(['50.00', '50.00'])
    expect(amounts('90.00', 3, -1)).toEqual(['30.00', '30.00', '30.00'])
  })

  it('el pagador absorbe el resto cuando participa', () => {
    expect(amounts('10000.00', 3, 0)).toEqual(['3333.34', '3333.33', '3333.33'])
    expect(amounts('10000.00', 3, 2)).toEqual(['3333.33', '3333.33', '3333.34'])
    expect(amounts('0.05', 3, 1)).toEqual(['0.01', '0.03', '0.01'])
  })

  it('sin el pagador, los primeros participantes reciben un centavo más', () => {
    expect(amounts('100.00', 3, -1)).toEqual(['33.34', '33.33', '33.33'])
    expect(amounts('0.05', 3, -1)).toEqual(['0.02', '0.02', '0.01'])
  })

  it('la suma siempre es exactamente el total', () => {
    for (const total of ['0.03', '1.00', '10.01', '999.99', '12345.67']) {
      for (let n = 1; n <= 7; n += 1) {
        if (toCents(total) < n) continue
        for (const payer of [0, -1]) {
          const sum = splitEqually(total, keys(n), payer === 0 ? 'k0' : 'x')
            .reduce((acc, share) => acc + share.cents, 0)
          expect(sum).toBe(toCents(total))
        }
      }
    }
  })

  it('el monto máximo se divide sin perder centavos', () => {
    const parts = amounts('999999999.99', 7, -1)
    expect(parts).toHaveLength(7)
    expect(parts[0]).toBe('142857142.86')
    expect(parts[6]).toBe('142857142.85')
  })

  it('devuelve una fila por clave con centavos y monto canónico, en el orden recibido', () => {
    expect(splitEqually('10.00', ['u:7', 's:4'], 'u:7')).toEqual([
      { key: 'u:7', cents: 500, amount: '5.00' },
      { key: 's:4', cents: 500, amount: '5.00' },
    ])
  })

  it('devuelve null si no alcanza un centavo por participante, sin participantes o con monto inválido', () => {
    expect(splitEqually('0.02', keys(3), 'k0')).toBeNull()
    expect(splitEqually('10.00', [], 'k0')).toBeNull()
    expect(splitEqually('10.00', undefined, 'k0')).toBeNull()
    expect(splitEqually('10', keys(2), 'k0')).toBeNull()
    expect(splitEqually('0.00', keys(2), 'k0')).toBeNull()
    expect(splitEqually(null, keys(2), 'k0')).toBeNull()
  })

  it('convierte entre centavos y texto canónico', () => {
    expect(toCents('1234.05')).toBe(123405)
    expect(toCents('abc')).toBeNull()
    expect(fromCents(5)).toBe('0.05')
    expect(fromCents(123405)).toBe('1234.05')
  })
})
