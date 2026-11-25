import { describe, expect, it } from 'vitest'
import { filterPeople, fullName } from './personSearch'

const ANA = { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' }
const JOSE = { firstName: 'José', lastName: null, email: 'jose.g@correo.com' }

describe('personSearch', () => {
  it('fullName omite el apellido nulo', () => {
    expect(fullName(ANA)).toBe('Ana Pérez')
    expect(fullName(JOSE)).toBe('José')
  })

  it('una búsqueda vacía o solo con espacios devuelve todos', () => {
    expect(filterPeople([ANA, JOSE], '')).toEqual([ANA, JOSE])
    expect(filterPeople([ANA, JOSE], '   ')).toEqual([ANA, JOSE])
  })

  it('busca por nombre completo sin importar mayúsculas ni tildes', () => {
    expect(filterPeople([ANA, JOSE], 'jose')).toEqual([JOSE])
    expect(filterPeople([ANA, JOSE], 'ANA PEREZ')).toEqual([ANA])
  })

  it('busca por mail', () => {
    expect(filterPeople([ANA, JOSE], 'correo.com')).toEqual([JOSE])
  })

  it('con personOf busca en la persona de cada elemento', () => {
    const requests = [{ id: 1, sender: ANA }, { id: 2, sender: JOSE }]
    expect(filterPeople(requests, 'pérez', (request) => request.sender)).toEqual([requests[0]])
  })
})
