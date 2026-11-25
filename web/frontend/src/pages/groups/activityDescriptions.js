// Frases del historial de actividad del grupo (specs/014-group-activity-history,
// contracts/activity-api.md §Contrato del frontend). Funciones puras: reciben
// una entrada de GET /api/groups/{id}/activity y devuelven texto en voseo.

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

const DAY_FORMAT = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const TIME_FORMAT = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
})

// Clave estable AAAA-MM-DD del día en Argentina, para agrupar (FR-015).
const DAY_KEY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
})

// Opciones del filtro "Mostrar" (FR-016): valor → tipos de evento del backend.
export const ACTIVITY_FILTERS = [
  { value: 'ALL', label: 'Toda la actividad', eventTypes: [] },
  { value: 'ADDED', label: 'Altas', eventTypes: ['MEMBER_ADDED'] },
  { value: 'REMOVED', label: 'Bajas', eventTypes: ['MEMBER_REMOVED', 'MEMBER_LEFT'] },
  {
    value: 'EXPENSES',
    label: 'Gastos',
    eventTypes: ['EXPENSE_CREATED', 'EXPENSE_EDITED', 'EXPENSE_DELETED'],
  },
  {
    value: 'PAYMENTS',
    label: 'Pagos',
    eventTypes: [
      'PAYMENT_MADE',
      'PAYMENT_REGISTERED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_REJECTED',
      'DEBT_OVERDUE',
      'LIQUIDATION_PROPOSED',
    ],
  },
  {
    value: 'REMINDERS',
    label: 'Recordatorios',
    eventTypes: ['DEBT_REMINDER_SENT', 'PAYER_DUE_NOTICE_SENT', 'DEBT_WHISTLED'],
  },
  { value: 'RECURRENCE', label: 'Recurrencia', eventTypes: ['RECURRENCE_PAUSED', 'RECURRENCE_RESUMED', 'RECURRENCE_FINISHED'] },
  { value: 'SETTINGS', label: 'Cambios del grupo', eventTypes: ['PERMISSION_CHANGED', 'PHOTO_CHANGED'] },
]

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function actorName(actor) {
  if (!actor) return 'Alguien'
  const full = [text(actor.firstName), text(actor.lastName)].filter(Boolean).join(' ')
  return full || 'Alguien'
}

export function formatMoney(amount, currency) {
  const value = Number(amount)
  const code = text(currency)
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(value)) return null
  if (!code) return String(amount)
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: code }).format(value)
  } catch {
    return `${code} ${amount}`
  }
}

function memberAdded(details) {
  const name = text(details.name) ?? text(details.email)
  const suffix = details.atCreation === true ? ' al crear el grupo' : ''
  if (!name) return `agregó a un miembro${suffix}`
  if (details.type === 'SIMULATED') return `agregó el perfil simulado ${name}${suffix}`
  return `agregó a ${name}${suffix}`
}

function memberRemoved(details) {
  const name = text(details.name) ?? text(details.email)
  // Las bajas de perfiles simulados anteriores a 014 no traen "type", pero sí
  // simulatedProfileId (data-model.md §Formatos anteriores).
  const simulated = details.type === 'SIMULATED' || details.simulatedProfileId != null
  if (!name) return 'quitó a un miembro del grupo'
  if (simulated) return `quitó el perfil simulado ${name}`
  return `quitó a ${name} del grupo`
}

function expenseCreated(details, actor) {
  const money = formatMoney(details.amount, details.currency)
  let sentence = money ? `registró un gasto de ${money}` : 'registró un gasto'
  const description = text(details.description)
  if (description) sentence += ` «${description}»`
  const payerName = text(details.payerName)
  if (payerName) {
    const differentPayer =
      (details.payerUserId != null && actor?.id != null && details.payerUserId !== actor.id)
      || (actor && payerName !== actorName(actor))
    sentence += differentPayer ? ` pagado por ${payerName}` : ` (pagó ${payerName})`
  }
  return sentence
}

function expenseEdited(details) {
  const description = text(details.description)
  return description ? `editó el gasto «${description}»` : 'editó un gasto'
}

function expenseDeleted(details) {
  const description = text(details.description)
  return description ? `eliminó el gasto «${description}»` : 'eliminó un gasto'
}

function paymentMade(details) {
  const money = formatMoney(details.amount, details.currency)
  let sentence = money ? `registró un pago de ${money}` : 'registró un pago'
  const from = text(details.fromName)
  const to = text(details.toName)
  if (from) sentence += ` de ${from}`
  if (to) sentence += ` a ${to}`
  return sentence
}

function paymentConfirmed(details) {
  const money = formatMoney(details.amount, details.currency)
  let sentence = money ? `confirmó el pago de ${money}` : 'confirmó un pago'
  const from = text(details.fromName)
  const to = text(details.toName)
  if (from) sentence += ` de ${from}`
  if (to) sentence += ` a ${to}`
  return sentence
}

function paymentRejected(details) {
  const money = formatMoney(details.amount, details.currency)
  let sentence = money ? `rechazó el pago de ${money}` : 'rechazó un pago'
  const from = text(details.fromName)
  const to = text(details.toName)
  if (from) sentence += ` de ${from}`
  if (to) sentence += ` a ${to}`
  return sentence
}

function debtOverdue(details) {
  const money = formatMoney(details.amount, details.currency)
  let sentence = money ? `venció la deuda de ${money}` : 'venció una deuda'
  const from = text(details.fromName)
  const to = text(details.toName)
  if (from) sentence += ` de ${from}`
  if (to) sentence += ` con ${to}`
  return sentence
}

function liquidationProposed(details) {
  const count = Number(details.transferCount)
  if (Number.isInteger(count) && count > 0) {
    const word = count === 1 ? 'transferencia' : 'transferencias'
    return `generó una propuesta de liquidación (${count} ${word})`
  }
  return 'generó una propuesta de liquidación'
}

function debtReminderSent(details) {
  const money = formatMoney(details.amount, details.currency)
  const debtor = text(details.fromName)
  let sentence = money ? `envió el recordatorio de la deuda de ${money}` : 'envió un recordatorio de deuda'
  if (debtor) sentence += ` a ${debtor}`
  return sentence
}

function payerDueNoticeSent(details) {
  const concept = text(details.concept)
  const payer = text(details.payerName)
  let sentence = concept
    ? `envió el aviso de vencimiento del gasto «${concept}»`
    : 'envió el aviso de vencimiento de un gasto'
  if (payer) sentence += ` a ${payer}`
  return sentence
}

function recurrenceDescription(verb, details) {
  const description = text(details.description)
  return description ? `${verb} el gasto recurrente «${description}»` : `${verb} un gasto recurrente`
}

function recurrencePaused(details) {
  return recurrenceDescription('pausó', details)
}

function recurrenceResumed(details) {
  return recurrenceDescription('reanudó', details)
}

function recurrenceFinished(details) {
  return recurrenceDescription('finalizó', details)
}

// 030: aviso manual del acreedor (el actor es quien avisó).
function debtWhistled(details) {
  const debtor = text(details.fromName) ?? 'alguien'
  const money = formatMoney(details.amount, details.currency)
  const concept = text(details.description)
  let sentence = `le avisó a ${debtor} por ${money ?? 'una deuda'}`
  if (concept) sentence += ` (${concept})`
  return sentence
}

const SYSTEM_EVENTS = new Set([
  'DEBT_OVERDUE',
  'DEBT_REMINDER_SENT',
  'PAYER_DUE_NOTICE_SENT',
  // 028: las ocurrencias recurrentes las genera el job, sin actor humano.
  'EXPENSE_CREATED',
])

const DESCRIBERS = {
  MEMBER_ADDED: memberAdded,
  MEMBER_REMOVED: memberRemoved,
  MEMBER_LEFT: () => 'abandonó el grupo',
  PERMISSION_CHANGED: () => 'cambió los permisos del grupo',
  PHOTO_CHANGED: () => 'cambió la foto del grupo',
  EXPENSE_CREATED: expenseCreated,
  EXPENSE_EDITED: expenseEdited,
  EXPENSE_DELETED: expenseDeleted,
  PAYMENT_MADE: paymentMade,
  PAYMENT_REGISTERED: paymentMade,
  PAYMENT_CONFIRMED: paymentConfirmed,
  PAYMENT_REJECTED: paymentRejected,
  DEBT_OVERDUE: debtOverdue,
  LIQUIDATION_PROPOSED: liquidationProposed,
  DEBT_REMINDER_SENT: debtReminderSent,
  PAYER_DUE_NOTICE_SENT: payerDueNoticeSent,
  RECURRENCE_PAUSED: recurrencePaused,
  RECURRENCE_RESUMED: recurrenceResumed,
  RECURRENCE_FINISHED: recurrenceFinished,
  DEBT_WHISTLED: debtWhistled,
}

// Eventos que abren el detalle del gasto: el gasto mismo (017, 022 edición) y sus
// pagos y deudas (018 FR-022; 022 US8). EXPENSE_DELETED nunca enlaza.
const LINKS_TO_EXPENSE = [
  'EXPENSE_CREATED',
  'EXPENSE_EDITED',
  'PAYMENT_MADE',
  'PAYMENT_REGISTERED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_REJECTED',
  'DEBT_OVERDUE',
  'DEBT_REMINDER_SENT',
  'PAYER_DUE_NOTICE_SENT',
  'RECURRENCE_PAUSED',
  'RECURRENCE_RESUMED',
  'RECURRENCE_FINISHED',
  'DEBT_WHISTLED',
]

/** Ids (texto) de los gastos que tienen un EXPENSE_DELETED entre las entradas. */
export function deletedExpenseIds(entries) {
  const ids = new Set()
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry?.eventType === 'EXPENSE_DELETED' && entry.details?.expenseId != null) {
      ids.add(String(entry.details.expenseId))
    }
  }
  return ids
}

/**
 * Id del gasto al que enlaza la entrada, o null: solo los tipos con gasto
 * asociado que traen `expenseId`, y nunca si las entradas cargadas muestran que
 * ese gasto se borró (`deleted`, de deletedExpenseIds). Los eventos viejos sin
 * `expenseId` no enlazan.
 */
export function expenseLinkId(entry, deleted = new Set()) {
  const id = entry?.details?.expenseId
  if (id == null || !LINKS_TO_EXPENSE.includes(entry.eventType)) return null
  return deleted.has(String(id)) ? null : id
}

// FR-014: { actor, text } para una entrada del historial.
export function describeActivity(entry) {
  const details = entry?.details && typeof entry.details === 'object' ? entry.details : {}
  const describe = DESCRIBERS[entry?.eventType]
  const actor = SYSTEM_EVENTS.has(entry?.eventType) && !entry?.actor ? 'Sistema' : actorName(entry?.actor)
  return {
    actor,
    text: describe ? describe(details, entry?.actor) : 'realizó una acción en el grupo',
  }
}

function toDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dayKey(value) {
  const date = toDate(value)
  return date ? DAY_KEY_FORMAT.format(date) : 'sin-fecha'
}

export function formatDay(value) {
  const date = toDate(value)
  if (!date) return 'Sin fecha'
  const day = DAY_FORMAT.format(date)
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export function formatTime(value) {
  const date = toDate(value)
  return date ? TIME_FORMAT.format(date) : ''
}

// FR-015: agrupa entradas ya ordenadas (más reciente primero) por día.
export function groupByDay(entries) {
  const groups = []
  for (const entry of entries) {
    const key = dayKey(entry.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.key === key) {
      last.entries.push(entry)
    } else {
      groups.push({ key, label: formatDay(entry.createdAt), entries: [entry] })
    }
  }
  return groups
}
