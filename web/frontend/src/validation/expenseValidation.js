import { ALL_CURRENCY_OPTIONS, codesOf } from './expenseCatalog'
// Pure expense validations (FR-011..FR-017, FR-022; research.md D3/D4/D5).
// The backend is the source of truth: these rules only provide immediate
// feedback. Amounts are handled as strings, never with Number/parseFloat, so the
// canonical two-decimal value reaches the API without floating-point loss.

export const AMOUNT_REQUIRED = 'El monto es obligatorio'
export const AMOUNT_FORMAT = 'Ingresá un monto válido'
export const AMOUNT_DECIMALS = 'El monto no puede tener más de dos decimales'
export const AMOUNT_POSITIVE = 'El monto debe ser mayor a cero'
export const AMOUNT_RANGE = 'El monto debe estar entre 0,01 y 999.999.999,99'

export const DATE_REQUIRED = 'La fecha es obligatoria'
export const DATE_FORMAT = 'Ingresá la fecha como dd/mm/aaaa'
export const DATE_INVALID = 'La fecha no existe'
export const DATE_FUTURE = 'La fecha no puede ser posterior a hoy'

// 033 (FR-009): an income may be dated up to one year after today (a scheduled one).
export const INCOME_DATE_TOO_FAR = 'La fecha no puede ser más de un año posterior a hoy'

export const DESCRIPTION_MAX_CODE_POINTS = 200
export const DESCRIPTION_LENGTH =
  'La descripción no puede superar los 200 caracteres'

const CURRENCY_ORDER = ['ARS', 'USD', 'EUR']
const SUPPORTED_CURRENCIES = codesOf(ALL_CURRENCY_OPTIONS)

function amountError(error) {
  return { ok: false, canonical: null, error }
}

/**
 * Parses Argentine amount notation into the canonical "integer.00" form.
 * `1.234,56`, `1 234,56` and `1234,56` are valid; `1,234` (three decimals),
 * `1234.56` (dot decimal) and malformed groupings are rejected. Returns
 * `{ ok, canonical, error }`.
 */
export function parseArgentineAmount(raw) {
  const text = typeof raw === 'string' ? trimAsciiSpace(raw) : ''
  if (text === '') {
    return amountError(AMOUNT_REQUIRED)
  }
  if (!/^[0-9., ]+$/.test(text)) {
    return amountError(AMOUNT_FORMAT)
  }
  if ((text.match(/,/g) ?? []).length > 1) {
    return amountError(AMOUNT_FORMAT)
  }

  const hasComma = text.includes(',')
  const [integerRaw, fractionRaw = ''] = hasComma ? text.split(',') : [text]
  if (hasComma && !/^\d+$/.test(fractionRaw)) {
    return amountError(AMOUNT_FORMAT)
  }
  if (fractionRaw.length > 2) {
    return amountError(AMOUNT_DECIMALS)
  }

  const integer = normalizeIntegerPart(integerRaw)
  if (integer === null) {
    return amountError(AMOUNT_FORMAT)
  }

  const integerNormalized = stripLeadingZeros(integer)
  const fraction = fractionRaw.padEnd(2, '0')
  if (integerNormalized === '0' && fraction === '00') {
    return amountError(AMOUNT_POSITIVE)
  }
  if (
    compareParts(integerNormalized, fraction, '0', '01') < 0 ||
    compareParts(integerNormalized, fraction, '999999999', '99') > 0
  ) {
    return amountError(AMOUNT_RANGE)
  }

  return { ok: true, canonical: `${integerNormalized}.${fraction}`, error: '' }
}

/** Integer part with dot/space thousands separators validated and removed, or null. */
function normalizeIntegerPart(raw) {
  if (raw === '') {
    return null
  }
  const hasDot = raw.includes('.')
  const hasSpace = raw.includes(' ')
  if (hasDot && hasSpace) {
    return null
  }
  if (hasDot) {
    return /^\d{1,3}(\.\d{3})*$/.test(raw) ? raw.replace(/\./g, '') : null
  }
  if (hasSpace) {
    return /^\d{1,3}( \d{3})*$/.test(raw) ? raw.replace(/ /g, '') : null
  }
  return /^\d+$/.test(raw) ? raw : null
}

// Java String.trim(): strips chars <= U+0020, unlike JS trim() which also strips
// NBSP/U+FEFF. This keeps both sides rejecting the same amount inputs.
function trimAsciiSpace(value) {
  let start = 0
  let end = value.length
  while (start < end && value.charCodeAt(start) <= 0x20) {
    start += 1
  }
  while (end > start && value.charCodeAt(end - 1) <= 0x20) {
    end -= 1
  }
  return value.slice(start, end)
}

function stripLeadingZeros(digits) {
  return digits.replace(/^0+(?=\d)/, '')
}

/** Compares two non-negative decimals with 2-digit fractions without numbers. */
function compareParts(aInteger, aFraction, bInteger, bFraction) {
  if (aInteger.length !== bInteger.length) {
    return aInteger.length < bInteger.length ? -1 : 1
  }
  if (aInteger !== bInteger) {
    return aInteger < bInteger ? -1 : 1
  }
  if (aFraction !== bFraction) {
    return aFraction < bFraction ? -1 : 1
  }
  return 0
}

/** Preferred currency of the profile: ARS → USD → EUR → any other supported one; none ⇒ ARS. */
export function preferredCurrency(currencies) {
  const available = Array.isArray(currencies) ? currencies : []
  // 027: a preference outside ARS/USD/EUR (e.g. only BRL) is still the user's currency.
  return (
    CURRENCY_ORDER.find((code) => available.includes(code)) ??
    available.find((code) => SUPPORTED_CURRENCIES.includes(code)) ??
    'ARS'
  )
}

/**
 * Parses `dd/mm/aaaa` (or `d/m/aaaa`) into ISO `yyyy-MM-dd`. Non-existent dates
 * such as `31/02` are rejected via a UTC round-trip, never rolled over.
 * Returns `{ ok, iso, error }`.
 */
export function parseArgentineDate(raw) {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (text === '') {
    return dateError(DATE_REQUIRED)
  }
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) {
    return dateError(DATE_FORMAT)
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return dateError(DATE_INVALID)
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { ok: true, iso, error: '' }
}

function dateError(error) {
  return { ok: false, iso: null, error }
}

/**
 * Trims leading/trailing Unicode whitespace by code point, normalizes CRLF/CR to
 * LF and keeps inner whitespace untouched. Same predicate as the backend
 * (Character.isWhitespace || Character.isSpaceChar): includes NBSP, U+2007 and
 * U+202F. Empty after trimming means absent (null).
 */
export function normalizeDescription(value) {
  if (value == null) {
    return null
  }
  const text = String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const codePoints = [...text]
  let start = 0
  let end = codePoints.length
  while (start < end && isWhitespaceCodePoint(codePoints[start].codePointAt(0))) {
    start += 1
  }
  while (end > start && isWhitespaceCodePoint(codePoints[end - 1].codePointAt(0))) {
    end -= 1
  }
  const trimmed = codePoints.slice(start, end).join('')
  return trimmed === '' ? null : trimmed
}

/** Empty string when valid, the Spanish message when the description exceeds 200 code points. */
export function validateDescription(value) {
  const normalized = normalizeDescription(value)
  if (normalized != null && [...normalized].length > DESCRIPTION_MAX_CODE_POINTS) {
    return DESCRIPTION_LENGTH
  }
  return ''
}

// Zs/Zl/Zp space characters plus the ASCII whitespace controls, mirroring the
// Java predicate used by the backend (no BOM U+FEFF, unlike JavaScript's \s).
function isWhitespaceCodePoint(codePoint) {
  return (
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0b ||
    codePoint === 0x0c ||
    codePoint === 0x0d ||
    (codePoint >= 0x1c && codePoint <= 0x1f) ||
    codePoint === 0x20 ||
    codePoint === 0xa0 ||
    codePoint === 0x1680 ||
    (codePoint >= 0x2000 && codePoint <= 0x200a) ||
    codePoint === 0x2028 ||
    codePoint === 0x2029 ||
    codePoint === 0x202f ||
    codePoint === 0x205f ||
    codePoint === 0x3000
  )
}

/** `yyyy-MM-dd` one year after `iso`; 29/02 becomes 28/02 like Java's LocalDate.plusYears. */
function oneYearAfter(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const next = new Date(Date.UTC(year + 1, month - 1, day))
  if (next.getUTCMonth() !== month - 1) {
    next.setUTCDate(0)
  }
  return next.toISOString().slice(0, 10)
}

/**
 * Empty string when `raw` (dd/mm/aaaa) is a valid income date: it exists and is not
 * later than one year after `todayIso` (yyyy-MM-dd); otherwise the Spanish message.
 * Unlike an expense, a future date is allowed.
 */
export function validateIncomeDate(raw, todayIso) {
  const date = parseArgentineDate(raw)
  if (!date.ok) {
    return date.error
  }
  if (todayIso && date.iso > oneYearAfter(todayIso)) {
    return INCOME_DATE_TOO_FAR
  }
  return ''
}
