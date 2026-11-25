// Closed expense catalogs shared by the expense form (FR-010/FR-011, D6).
// The persisted/API value is the stable English code; the Spanish label lives
// only here. The exact code lists are fixed by expenseCatalog.test.js and must
// stay in sync with the backend enums and the V4 CHECK constraints.
export const CURRENCY_OPTIONS = Object.freeze([
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'USD', label: 'Dólar estadounidense' },
  { code: 'EUR', label: 'Euro' },
])

// 027 (FR-011 a FR-014): the 32 currencies an expense or a preference accepts,
// the same constants as the backend Currency enum and the V27 CHECKs. ARS, USD and
// EUR come first (same order as CURRENCY_OPTIONS); the rest, alphabetically by code.
// CURRENCY_OPTIONS above stays as the group primary-currency catalog (027 R3).
export const ALL_CURRENCY_OPTIONS = Object.freeze([
  ...CURRENCY_OPTIONS,
  { code: 'AUD', label: 'Dólar australiano' },
  { code: 'AWG', label: 'Florín arubeño' },
  { code: 'BOB', label: 'Boliviano' },
  { code: 'BRL', label: 'Real brasileño' },
  { code: 'CAD', label: 'Dólar canadiense' },
  { code: 'CHF', label: 'Franco suizo' },
  { code: 'CLP', label: 'Peso chileno' },
  { code: 'CNY', label: 'Yuan chino' },
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'CZK', label: 'Corona checa' },
  { code: 'DKK', label: 'Corona danesa' },
  { code: 'GBP', label: 'Libra esterlina' },
  { code: 'HKD', label: 'Dólar de Hong Kong' },
  { code: 'ILS', label: 'Nuevo séquel israelí' },
  { code: 'INR', label: 'Rupia india' },
  { code: 'JPY', label: 'Yen japonés' },
  { code: 'MXN', label: 'Peso mexicano' },
  { code: 'NIO', label: 'Córdoba nicaragüense' },
  { code: 'NOK', label: 'Corona noruega' },
  { code: 'NZD', label: 'Dólar neozelandés' },
  { code: 'PEN', label: 'Sol peruano' },
  { code: 'PYG', label: 'Guaraní paraguayo' },
  { code: 'RSD', label: 'Dinar serbio' },
  { code: 'RUB', label: 'Rublo ruso' },
  { code: 'SEK', label: 'Corona sueca' },
  { code: 'SGD', label: 'Dólar de Singapur' },
  { code: 'TRY', label: 'Lira turca' },
  { code: 'UYU', label: 'Peso uruguayo' },
  { code: 'ZAR', label: 'Rand sudafricano' },
])

/**
 * Spanish label of a currency code; `fallback` (e.g. the BCRA name) for a code
 * without a label, and the code itself when there is neither.
 */
export function currencyLabel(code, fallback) {
  return labelOf(ALL_CURRENCY_OPTIONS, code) || fallback || code
}

export const CATEGORY_OPTIONS = Object.freeze([
  { code: 'FOOD', label: 'Alimentos' },
  { code: 'TRANSPORT', label: 'Transporte' },
  { code: 'HOUSING', label: 'Vivienda' },
  { code: 'SERVICES', label: 'Servicios' },
  { code: 'HEALTH', label: 'Salud' },
  { code: 'EDUCATION', label: 'Educación' },
  { code: 'LEISURE', label: 'Ocio' },
  { code: 'SHOPPING', label: 'Compras' },
  { code: 'PETS', label: 'Mascotas' },
  { code: 'OTHER', label: 'Otros' },
])

/**
 * Fixed color of a category in the statistics (032, FR-016, plan D14): the same in
 * both pies and every month. The values live in StatisticsPage.scss as CSS custom
 * properties, one per theme.
 */
export function categoryColor(code) {
  return `var(--color-categoria-${String(code).toLowerCase()})`
}

export const TYPE_OPTIONS = Object.freeze([
  { code: 'RECURRING', label: 'Recurrente' },
  { code: 'ONE_TIME', label: 'Único' },
])

// Feature 009 (specs/009-pause-recurring-expense): frequency of a recurring series
// and its state. Codes match RecurrenceFrequency/RecurrenceStatus and the V5 CHECKs.
export const FREQUENCY_OPTIONS = Object.freeze([
  { code: 'WEEKLY', label: 'Semanal' },
  { code: 'MONTHLY', label: 'Mensual' },
  { code: 'YEARLY', label: 'Anual' },
])

export const STATUS_OPTIONS = Object.freeze([
  { code: 'ACTIVE', label: 'Activo' },
  { code: 'PAUSED', label: 'Pausado' },
  { code: 'FINISHED', label: 'Finalizado' },
])

export const PAYMENT_METHOD_OPTIONS = Object.freeze([
  { code: 'CASH', label: 'Efectivo' },
  { code: 'DEBIT_CARD', label: 'Tarjeta de débito' },
  { code: 'CREDIT_CARD', label: 'Tarjeta de crédito' },
  { code: 'TRANSFER', label: 'Transferencia' },
  { code: 'VIRTUAL_WALLET', label: 'Billetera virtual' },
  { code: 'OTHER', label: 'Otro' },
])

// Feature 033 (specs/033-income-management): personal income catalogs. Codes match the
// backend IncomeCategory/IncomePaymentMethod enums and the V38 CHECK constraints.
export const INCOME_CATEGORY_OPTIONS = Object.freeze([
  { code: 'SALARY', label: 'Sueldo' },
  { code: 'FREELANCE', label: 'Freelance' },
  { code: 'SALE', label: 'Venta' },
  { code: 'REFUND', label: 'Reembolso' },
  { code: 'OTHER', label: 'Otros' },
])

/**
 * Fixed color of an income category in the statistics (034, FR-022, plan D15),
 * distinct from the expense palette. The values live in StatisticsPage.scss.
 */
export function incomeCategoryColor(code) {
  return `var(--color-ingreso-${String(code).toLowerCase()})`
}

// A payment received: the card methods of expenses do not apply.
export const INCOME_PAYMENT_METHOD_OPTIONS = Object.freeze([
  { code: 'CASH', label: 'Efectivo' },
  { code: 'TRANSFER', label: 'Transferencia' },
  { code: 'VIRTUAL_WALLET', label: 'Billetera virtual' },
  { code: 'OTHER', label: 'Otro' },
])

/** Codes of an option catalog, in catalog order. */
export function codesOf(options) {
  return options.map((option) => option.code)
}

/** Spanish label of a code, or an empty string when the code is not in the catalog. */
export function labelOf(options, code) {
  return options.find((option) => option.code === code)?.label ?? ''
}
