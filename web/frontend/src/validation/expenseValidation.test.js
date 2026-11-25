import { describe, expect, it } from 'vitest'

import {
  AMOUNT_DECIMALS,
  AMOUNT_FORMAT,
  AMOUNT_POSITIVE,
  AMOUNT_RANGE,
  AMOUNT_REQUIRED,
  DATE_FORMAT,
  DATE_INVALID,
  DATE_REQUIRED,
  DESCRIPTION_LENGTH,
  INCOME_DATE_TOO_FAR,
  normalizeDescription,
  parseArgentineAmount,
  parseArgentineDate,
  preferredCurrency,
  validateDescription,
  validateIncomeDate,
} from './expenseValidation'

describe('parseArgentineAmount', () => {
  it.each([
    ['0,01', '0.01'],
    ['0,10', '0.10'],
    ['0,99', '0.99'],
    ['1,00', '1.00'],
    ['1,10', '1.10'],
    ['10,10', '10.10'],
    ['100,01', '100.01'],
    ['1234,56', '1234.56'],
    ['1.234,56', '1234.56'],
    ['1 234,56', '1234.56'],
    ['10', '10.00'],
    ['10,5', '10.50'],
    ['1.234', '1234.00'],
    ['999.999,99', '999999.99'],
    ['123.456.789,01', '123456789.01'],
    ['999.999.999,98', '999999999.98'],
    ['999.999.999,99', '999999999.99'],
    ['  15,25  ', '15.25'],
  ])('normalizes %s to %s', (raw, canonical) => {
    expect(parseArgentineAmount(raw)).toEqual({ ok: true, canonical, error: '' })
  })

  it.each([
    ['', AMOUNT_REQUIRED],
    ['   ', AMOUNT_REQUIRED],
    [null, AMOUNT_REQUIRED],
    [undefined, AMOUNT_REQUIRED],
    ['abc', AMOUNT_FORMAT],
    ['-5', AMOUNT_FORMAT],
    ['+5', AMOUNT_FORMAT],
    ['1e3', AMOUNT_FORMAT],
    ['1E+2', AMOUNT_FORMAT],
    ['1 0,10', AMOUNT_FORMAT],
    ['\u00a010,10', AMOUNT_FORMAT],
    ['\ufeff10,10', AMOUNT_FORMAT],
    [',5', AMOUNT_FORMAT],
    ['1234,', AMOUNT_FORMAT],
    ['1,5,6', AMOUNT_FORMAT],
    ['1.23.456', AMOUNT_FORMAT],
    ['1 23 456', AMOUNT_FORMAT],
    ['1.234 567', AMOUNT_FORMAT],
    ['1234.56', AMOUNT_FORMAT],
    ['1,234', AMOUNT_DECIMALS],
    ['0', AMOUNT_POSITIVE],
    ['0,00', AMOUNT_POSITIVE],
    ['000', AMOUNT_POSITIVE],
    ['1.000.000.000,00', AMOUNT_RANGE],
    ['1.000.000.000', AMOUNT_RANGE],
    ['9999999999', AMOUNT_RANGE],
  ])('rejects %s with the expected message', (raw, error) => {
    expect(parseArgentineAmount(raw)).toEqual({
      ok: false,
      canonical: null,
      error,
    })
  })

  it('never rounds a three-decimal amount into a valid one', () => {
    expect(parseArgentineAmount('1,234').canonical).toBeNull()
  })
})

describe('preferredCurrency', () => {
  it('prefers ARS over USD and EUR', () => {
    expect(preferredCurrency(['USD', 'ARS', 'EUR'])).toBe('ARS')
  })

  it('falls back to USD when ARS is absent', () => {
    expect(preferredCurrency(['EUR', 'USD'])).toBe('USD')
  })

  it('uses EUR when it is the only known currency', () => {
    expect(preferredCurrency(['EUR'])).toBe('EUR')
  })

  it('defaults to ARS for absent, empty or unknown currencies', () => {
    expect(preferredCurrency(undefined)).toBe('ARS')
    expect(preferredCurrency(null)).toBe('ARS')
    expect(preferredCurrency([])).toBe('ARS')
    // 027: any supported currency counts; an unsupported code still falls back to ARS.
    expect(preferredCurrency(['GBP'])).toBe('GBP')
    expect(preferredCurrency(['XAU'])).toBe('ARS')
    expect(preferredCurrency('ARS')).toBe('ARS')
  })
})

describe('parseArgentineDate', () => {
  it.each([
    ['21/10/2026', '2026-10-21'],
    ['1/2/2026', '2026-02-01'],
    ['31/12/2026', '2026-12-31'],
    ['29/02/2024', '2024-02-29'],
    ['  05/06/2026  ', '2026-06-05'],
  ])('parses %s to %s', (raw, iso) => {
    expect(parseArgentineDate(raw)).toEqual({ ok: true, iso, error: '' })
  })

  it.each([
    ['', DATE_REQUIRED],
    [null, DATE_REQUIRED],
    ['2026-10-21', DATE_FORMAT],
    ['21/10/26', DATE_FORMAT],
    ['21-10-2026', DATE_FORMAT],
    ['31/02/2026', DATE_INVALID],
    ['29/02/2025', DATE_INVALID],
    ['32/01/2026', DATE_INVALID],
    ['01/13/2026', DATE_INVALID],
    ['0/1/2026', DATE_INVALID],
  ])('rejects %s with the expected message', (raw, error) => {
    expect(parseArgentineDate(raw)).toEqual({
      ok: false,
      iso: null,
      error,
    })
  })
})

describe('normalizeDescription', () => {
  it('returns null for absent or blank values', () => {
    expect(normalizeDescription(null)).toBeNull()
    expect(normalizeDescription(undefined)).toBeNull()
    expect(normalizeDescription('')).toBeNull()
    expect(normalizeDescription('   ')).toBeNull()
    expect(normalizeDescription('\t\n ')).toBeNull()
  })

  it('trims Unicode spaces that JavaScript \\s does not trim', () => {
    expect(normalizeDescription('\u00a0Supermercado\u00a0')).toBe('Supermercado')
    expect(normalizeDescription('\u2007Cena\u2007')).toBe('Cena')
    expect(normalizeDescription('\u202fTaxi\u202f')).toBe('Taxi')
  })

  it('does not treat a BOM as whitespace, matching the backend', () => {
    expect(normalizeDescription('\ufeff')).toBe('\ufeff')
  })

  it('normalizes CRLF and CR to LF', () => {
    expect(normalizeDescription('linea1\r\nlinea2\rlinea3')).toBe(
      'linea1\nlinea2\nlinea3',
    )
  })

  it('preserves inner whitespace without collapsing it', () => {
    expect(normalizeDescription('  dos   espacios  ')).toBe('dos   espacios')
    expect(normalizeDescription('cafe\tcon leche')).toBe('cafe\tcon leche')
  })
})

describe('validateDescription', () => {
  it('accepts descriptions up to 200 code points', () => {
    expect(validateDescription('x'.repeat(200))).toBe('')
  })

  it('rejects descriptions over 200 code points', () => {
    expect(validateDescription('x'.repeat(201))).toBe(DESCRIPTION_LENGTH)
    expect(validateDescription(`  ${'x'.repeat(201)}  `)).toBe(DESCRIPTION_LENGTH)
  })

  it('counts code points, not UTF-16 units', () => {
    expect(validateDescription('😀'.repeat(200))).toBe('')
    expect(validateDescription('😀'.repeat(201))).toBe(DESCRIPTION_LENGTH)
  })

  it('treats whitespace-only descriptions as absent', () => {
    expect(validateDescription('   ')).toBe('')
  })
})

describe('validateIncomeDate (033)', () => {
  it('accepts today, a past date and a scheduled one within a year', () => {
    expect(validateIncomeDate('17/11/2026', '2026-11-17')).toBe('')
    expect(validateIncomeDate('01/01/2020', '2026-11-17')).toBe('')
    expect(validateIncomeDate('17/02/2027', '2026-11-17')).toBe('')
  })

  it('accepts exactly one year after today and rejects one day later', () => {
    expect(validateIncomeDate('17/11/2027', '2026-11-17')).toBe('')
    expect(validateIncomeDate('18/11/2027', '2026-11-17')).toBe(INCOME_DATE_TOO_FAR)
  })

  it('treats 29/02 as 28/02 of the next year, like the backend', () => {
    expect(validateIncomeDate('28/02/2025', '2024-02-29')).toBe('')
    expect(validateIncomeDate('01/03/2025', '2024-02-29')).toBe(INCOME_DATE_TOO_FAR)
  })

  it('reports the same format errors as an expense date', () => {
    expect(validateIncomeDate('', '2026-11-17')).toBe(DATE_REQUIRED)
    expect(validateIncomeDate('2026-11-17', '2026-11-17')).toBe(DATE_FORMAT)
    expect(validateIncomeDate('31/02/2026', '2026-11-17')).toBe(DATE_INVALID)
  })

  it('does not limit the date when today is unknown', () => {
    expect(validateIncomeDate('01/01/2099', null)).toBe('')
  })
})
