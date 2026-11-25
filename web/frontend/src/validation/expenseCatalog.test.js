import { describe, expect, it } from 'vitest'

import {
  CATEGORY_OPTIONS,
  CURRENCY_OPTIONS,
  FREQUENCY_OPTIONS,
  INCOME_CATEGORY_OPTIONS,
  INCOME_PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  categoryColor,
  codesOf,
  incomeCategoryColor,
  labelOf,
} from './expenseCatalog'

describe('expenseCatalog', () => {
  it('fixes the currency codes and their Spanish labels', () => {
    expect(codesOf(CURRENCY_OPTIONS)).toEqual(['ARS', 'USD', 'EUR'])
    expect(labelOf(CURRENCY_OPTIONS, 'ARS')).toBe('Peso argentino')
    expect(labelOf(CURRENCY_OPTIONS, 'USD')).toBe('Dólar estadounidense')
    expect(labelOf(CURRENCY_OPTIONS, 'EUR')).toBe('Euro')
  })

  it('fixes the category codes and their Spanish labels', () => {
    expect(codesOf(CATEGORY_OPTIONS)).toEqual([
      'FOOD',
      'TRANSPORT',
      'HOUSING',
      'SERVICES',
      'HEALTH',
      'EDUCATION',
      'LEISURE',
      'SHOPPING',
      'PETS',
      'OTHER',
    ])
    expect(labelOf(CATEGORY_OPTIONS, 'FOOD')).toBe('Alimentos')
    expect(labelOf(CATEGORY_OPTIONS, 'EDUCATION')).toBe('Educación')
    expect(labelOf(CATEGORY_OPTIONS, 'OTHER')).toBe('Otros')
  })

  it('fixes the expense type codes', () => {
    expect(codesOf(TYPE_OPTIONS)).toEqual(['RECURRING', 'ONE_TIME'])
    expect(labelOf(TYPE_OPTIONS, 'RECURRING')).toBe('Recurrente')
    expect(labelOf(TYPE_OPTIONS, 'ONE_TIME')).toBe('Único')
  })

  it('fixes the payment method codes', () => {
    expect(codesOf(PAYMENT_METHOD_OPTIONS)).toEqual([
      'CASH',
      'DEBIT_CARD',
      'CREDIT_CARD',
      'TRANSFER',
      'VIRTUAL_WALLET',
      'OTHER',
    ])
    expect(labelOf(PAYMENT_METHOD_OPTIONS, 'DEBIT_CARD')).toBe('Tarjeta de débito')
    expect(labelOf(PAYMENT_METHOD_OPTIONS, 'VIRTUAL_WALLET')).toBe('Billetera virtual')
  })

  it('returns an empty label for an unknown code', () => {
    expect(labelOf(CATEGORY_OPTIONS, 'UNKNOWN')).toBe('')
  })

  it('exposes frozen catalogs so they cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CURRENCY_OPTIONS)).toBe(true)
    expect(Object.isFrozen(CATEGORY_OPTIONS)).toBe(true)
    expect(Object.isFrozen(TYPE_OPTIONS)).toBe(true)
    expect(Object.isFrozen(PAYMENT_METHOD_OPTIONS)).toBe(true)
    expect(Object.isFrozen(FREQUENCY_OPTIONS)).toBe(true)
    expect(Object.isFrozen(STATUS_OPTIONS)).toBe(true)
  })

  it('fixes the recurrence frequency codes (009, FR-001)', () => {
    expect(codesOf(FREQUENCY_OPTIONS)).toEqual(['WEEKLY', 'MONTHLY', 'YEARLY'])
    expect(labelOf(FREQUENCY_OPTIONS, 'WEEKLY')).toBe('Semanal')
    expect(labelOf(FREQUENCY_OPTIONS, 'MONTHLY')).toBe('Mensual')
    expect(labelOf(FREQUENCY_OPTIONS, 'YEARLY')).toBe('Anual')
  })

  it('fixes the series status codes (009, FR-007)', () => {
    expect(codesOf(STATUS_OPTIONS)).toEqual(['ACTIVE', 'PAUSED', 'FINISHED'])
    expect(labelOf(STATUS_OPTIONS, 'ACTIVE')).toBe('Activo')
    expect(labelOf(STATUS_OPTIONS, 'PAUSED')).toBe('Pausado')
    expect(labelOf(STATUS_OPTIONS, 'FINISHED')).toBe('Finalizado')
  })

  it('fixes the income category codes and their Spanish labels (033)', () => {
    expect(codesOf(INCOME_CATEGORY_OPTIONS)).toEqual([
      'SALARY',
      'FREELANCE',
      'SALE',
      'REFUND',
      'OTHER',
    ])
    expect(labelOf(INCOME_CATEGORY_OPTIONS, 'SALARY')).toBe('Sueldo')
    expect(labelOf(INCOME_CATEGORY_OPTIONS, 'FREELANCE')).toBe('Freelance')
    expect(labelOf(INCOME_CATEGORY_OPTIONS, 'SALE')).toBe('Venta')
    expect(labelOf(INCOME_CATEGORY_OPTIONS, 'REFUND')).toBe('Reembolso')
    expect(labelOf(INCOME_CATEGORY_OPTIONS, 'OTHER')).toBe('Otros')
  })

  it('fixes the income payment method codes, without the card methods (033)', () => {
    expect(codesOf(INCOME_PAYMENT_METHOD_OPTIONS)).toEqual([
      'CASH',
      'TRANSFER',
      'VIRTUAL_WALLET',
      'OTHER',
    ])
    expect(labelOf(INCOME_PAYMENT_METHOD_OPTIONS, 'TRANSFER')).toBe('Transferencia')
    expect(labelOf(INCOME_PAYMENT_METHOD_OPTIONS, 'DEBIT_CARD')).toBe('')
    expect(Object.isFrozen(INCOME_CATEGORY_OPTIONS)).toBe(true)
    expect(Object.isFrozen(INCOME_PAYMENT_METHOD_OPTIONS)).toBe(true)
  })
})

describe('colores de las estadísticas (032, 034)', () => {
  it('cada categoría de ingreso usa su variable CSS, distinta de la de gastos', () => {
    expect(incomeCategoryColor('SALARY')).toBe('var(--color-ingreso-salary)')
    const colors = INCOME_CATEGORY_OPTIONS.map((option) => incomeCategoryColor(option.code))
    expect(new Set(colors).size).toBe(INCOME_CATEGORY_OPTIONS.length)
    expect(colors).not.toContain(categoryColor('OTHER'))
  })

  it('la categoría de gasto sigue usando su variable CSS', () => {
    expect(categoryColor('FOOD')).toBe('var(--color-categoria-food)')
  })
})
