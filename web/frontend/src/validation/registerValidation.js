// Shared pure validations for the registration form (task T014).
// Source of truth: specs/001-user-registration/spec.md FR-002/FR-003/FR-004/FR-006/
// FR-009/FR-010/FR-012 and clarifications Q2 (password max 64), Q3 (CBU
// normalization), Q4 (trim before validating). Messages in Spanish (FR-018).

/** FR-006: minimum 8 chars (Q2: maximum 64). */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 64

/** Visible rule shared by every password field (register, reset, change). */
export const PASSWORD_REQUIREMENTS =
  'Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un símbolo'

/** FR-010: avatar size limit. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png']

export function trim(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// FR-002 / Q4: 2–50 measured after trim.
export function validateFirstName(value) {
  const length = trim(value).length
  if (length < 2 || length > 50) {
    return 'El nombre debe tener entre 2 y 50 caracteres'
  }
  return ''
}

// FR-003 / Q4: optional art; when informed, 2–50 after trim.
export function validateLastName(value) {
  if (value == null || trim(value) === '') {
    return ''
  }
  const length = trim(value).length
  if (length < 2 || length > 50) {
    return 'El apellido debe tener entre 2 y 50 caracteres'
  }
  return ''
}

// FR-004: email identity is trim + lowercase.
export function normalizeEmail(value) {
  return trim(value).toLowerCase()
}

export function validateEmail(value) {
  const email = trim(value)
  const EMAIL_PATTERN = /^[^\s@]+@([^\s@,]+\.)+[^\s@,]{2,}$/
  if (!EMAIL_PATTERN.test(email)) {
    return 'Ingresá un correo electrónico válido'
  }
  return ''
}

// FR-006 / Q2: 8–64 with at least one uppercase, lowercase, digit and special char.
export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH) {
    return 'La contraseña debe tener al menos 8 caracteres'
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return 'La contraseña no puede superar los 64 caracteres'
  }
  const missing =
    !/[A-Z]/.test(value) ||
    !/[a-z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  if (missing) {
    return 'La contraseña debe incluir una mayúscula, una minúscula, un número y un símbolo'
  }
  return ''
}

export function validateConfirmPassword(password, confirmation) {
  if (confirmation !== password) {
    return 'Las contraseñas no coinciden'
  }
  return ''
}

// FR-009 / Q3: strip only separator spaces and dashes; the expected value is 22 digits.
export function normalizeCbu(value) {
  return typeof value === 'string' ? value.replace(/[ -]/g, '') : ''
}

export function validateCbu(value) {
  if (value == null || normalizeCbu(value) === '') {
    return ''
  }
  if (!/^[0-9]{22}$/.test(normalizeCbu(value))) {
    return 'El CBU/CVU debe tener 22 dígitos'
  }
  return ''
}

// FR-010: only jpg/jpeg/png, at most 2 MB.
export function validateAvatarFile(file) {
  if (!file) {
    return ''
  }
  if (!AVATAR_CONTENT_TYPES.includes(file.type)) {
    return 'La imagen debe ser JPG o PNG'
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return 'La imagen no puede superar los 2 MB'
  }
  return ''
}

// FR-012: explicit consent is required to create the account.
export function validateAcceptTerms(accepted) {
  if (!accepted) {
    return 'Debes aceptar los Términos y Condiciones para registrarte'
  }
  return ''
}
