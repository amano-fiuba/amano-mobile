import { describe, expect, it } from 'vitest'

import { problemOf, safeFields } from './problemDetail'

describe('problemDetail', () => {
  it('keeps only string field messages', () => {
    expect(safeFields({ amount: 'Monto inválido', date: 3, other: null })).toEqual({
      amount: 'Monto inválido',
    })
  })

  it('returns an empty object for missing or malformed fields', () => {
    expect(safeFields(undefined)).toEqual({})
    expect(safeFields(null)).toEqual({})
    expect(safeFields(['a'])).toEqual({})
    expect(safeFields('x')).toEqual({})
  })

  it('reads the JSON body of an error response', async () => {
    const response = { json: async () => ({ detail: 'Algo falló' }) }
    expect(await problemOf(response)).toEqual({ detail: 'Algo falló' })
  })

  it('falls back to an empty object when the body is not JSON', async () => {
    const response = {
      json: async () => {
        throw new Error('no body')
      },
    }
    expect(await problemOf(response)).toEqual({})
  })
})
