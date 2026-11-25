import { describe, expect, it } from 'vitest'
// Tests-first (task T013): module registerValidation.js is implemented in T014.
// Rules from spec.md FR-002/FR-003/FR-004/FR-006/FR-009/FR-010 and clarifications Q2/Q3/Q4.
import {
  validateFirstName,
  validateLastName,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  normalizeCbu,
  validateCbu,
  validateAvatarFile,
  validateAcceptTerms,
} from './registerValidation'

describe('validateFirstName (FR-002, Q4)', () => {
  it('mide la longitud tras trim', () => {
    expect(validateFirstName('  Ana  ')).toBe('')
  })

  it('rechaza menos de 2 caracteres tras trim', () => {
    expect(validateFirstName('   A   ')).toMatch(/(2 y 50|entre 2)/)
  })

  it('acepta 2 y 50 caracteres exactos', () => {
    expect(validateFirstName('An')).toBe('')
    expect(validateFirstName('x'.repeat(50))).toBe('')
  })

  it('rechaza más de 50 caracteres', () => {
    expect(validateFirstName('x'.repeat(51))).toMatch(/2 y 50/)
  })
})

describe('validateLastName (FR-003, Q4)', () => {
  it('es opcional: vacío o Solo espacios es válido', () => {
    expect(validateLastName('')).toBe('')
    expect(validateLastName('   ')).toBe('')
    expect(validateLastName(null)).toBe('')
  })

  it('valida 2–50 tras trim cuando se informa', () => {
    expect(validateLastName('  Ana  ')).toBe('')
    expect(validateLastName('A')).toMatch(/2 y 50/)
    expect(validateLastName('x'.repeat(51))).toMatch(/2 y 50/)
  })
})

describe('validateEmail (FR-004)', () => {
  it('trimea espacios y normaliza a minúsculas', () => {
    expect(normalizeEmail('  Ana.Perez@Example.COM ')).toBe('ana.perez@example.com')
  })

  it('el trim no salva un formato inválido', () => {
    expect(validateEmail('  Ana.Perez@Example.COM ')).toBe('')
    expect(validateEmail('no-email')).toMatch(/correo/i)
    expect(validateEmail('a@b')).toMatch(/correo/i)
  })
})

describe('validatePassword (FR-006, Q2: máx 64)', () => {
  it('acepta una contraseña válida', () => {
    expect(validatePassword('Password123!')).toBe('')
  })

  it('rechaza menos de 8 caracteres', () => {
    expect(validatePassword('Pa1!x')).toMatch(/8/)
  })

  it('acepta exactamente 64 caracteres (Q2)', () => {
    expect(validatePassword('a'.repeat(60) + 'B1!')).toBe('')
  })

  it('rechaza más de 64 caracteres (Q2)', () => {
    expect(validatePassword('a'.repeat(62) + 'B1!')).toMatch(/64/)
  })

  it('exige mayúscula, minúscula, dígito y carácter especial', () => {
    expect(validatePassword('password123!')).toMatch(/contraseña/i)
    expect(validatePassword('PASSWORD123!')).toMatch(/contraseña/i)
    expect(validatePassword('Password!!!!')).toMatch(/contraseña/i)
    expect(validatePassword('Password1234')).toMatch(/contraseña/i)
  })
})

describe('validateConfirmPassword', () => {
  it('exige coincidencia exacta', () => {
    expect(validateConfirmPassword('Password123!', 'Password123!')).toBe('')
    expect(validateConfirmPassword('Password123!', 'Password124!')).toMatch(/coinciden/i)
  })
})

describe('validateCbu (FR-009, Q3)', () => {
  it('normaliza espacios y guiones separadores', () => {
    expect(normalizeCbu('285-05910-0123456789012 34')).toBe('28505910012345678901 234'.replace(/[ -]/g, ''))
  })

  it('acepta exactamente 22 dígitos tras normalizar', () => {
    expect(validateCbu('285059100123456789 0123')).toBe('')
  })

  it('es opcional', () => {
    expect(validateCbu('')).toBe('')
    expect(validateCbu(null)).toBe('')
  })

  it('rechaza distinta cantidad de dígitos', () => {
    expect(validateCbu('2850591001234')).toMatch(/22/)
    expect(validateCbu('285059100123456789012345')).toMatch(/22/)
  })

  it('rechaza letras', () => {
    expect(validateCbu('2850591001234567890ABC3')).toMatch(/22/)
  })
})

describe('validateAvatarFile (FR-010)', () => {
  const fakeFile = (type, size) => ({ type, size, name: 'avatar' })

  it('acepta jpg/jpeg/png dentro del límite', () => {
    expect(validateAvatarFile(fakeFile('image/jpeg', 1024))).toBe('')
    expect(validateAvatarFile(fakeFile('image/png', 2 * 1024 * 1024))).toBe('')
  })

  it('rechaza otros formatos', () => {
    expect(validateAvatarFile(fakeFile('image/gif', 1024))).toMatch(/JPG/i)
    expect(validateAvatarFile(fakeFile('application/pdf', 1024))).toMatch(/JPG/i)
  })

  it('rechaza más de 2 MB', () => {
    expect(validateAvatarFile(fakeFile('image/jpeg', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/)
  })
})

describe('validateAcceptTerms (FR-012)', () => {
  it('exige el consentimiento explícito', () => {
    expect(validateAcceptTerms(true)).toBe("")
    expect(validateAcceptTerms(false)).toMatch(/T[ée]rminos/i)
  })
})
