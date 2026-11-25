import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_FILTERS,
  actorName,
  dayKey,
  deletedExpenseIds,
  describeActivity,
  expenseLinkId,
  formatDay,
  formatMoney,
  formatTime,
  groupByDay,
} from './activityDescriptions'

const ANA = { id: 7, firstName: 'Ana', lastName: 'López' }

function phrase(eventType, details, actor = ANA) {
  const { actor: name, text } = describeActivity({ eventType, details, actor })
  return `${name} ${text}`
}

describe('describeActivity: altas y bajas (014 US1)', () => {
  it('describe altas de registrados y simulados, con y sin creación del grupo', () => {
    expect(phrase('MEMBER_ADDED', { type: 'REGISTERED', name: 'Juan Pérez' }))
      .toBe('Ana López agregó a Juan Pérez')
    expect(phrase('MEMBER_ADDED', { type: 'REGISTERED', name: 'Juan Pérez', atCreation: true }))
      .toBe('Ana López agregó a Juan Pérez al crear el grupo')
    expect(phrase('MEMBER_ADDED', { type: 'SIMULATED', name: 'Abuela "Tita"' }))
      .toBe('Ana López agregó el perfil simulado Abuela "Tita"')
    expect(phrase('MEMBER_ADDED', { type: 'SIMULATED', name: 'Abuela', atCreation: true }))
      .toBe('Ana López agregó el perfil simulado Abuela al crear el grupo')
  })

  it('usa el correo o una frase genérica en las altas anteriores a 014', () => {
    expect(phrase('MEMBER_ADDED', { type: 'REGISTERED', email: 'juan@example.com' }))
      .toBe('Ana López agregó a juan@example.com')
    expect(phrase('MEMBER_ADDED', null)).toBe('Ana López agregó a un miembro')
    expect(phrase('MEMBER_ADDED', { atCreation: true, name: '  ' }))
      .toBe('Ana López agregó a un miembro al crear el grupo')
  })

  it('describe bajas de registrados y simulados, incluidas las viejas', () => {
    expect(phrase('MEMBER_REMOVED', { type: 'REGISTERED', userId: 15, name: 'Juan Pérez' }))
      .toBe('Ana López quitó a Juan Pérez del grupo')
    expect(phrase('MEMBER_REMOVED', { type: 'SIMULATED', name: 'Abuela' }))
      .toBe('Ana López quitó el perfil simulado Abuela')
    // formato viejo de 010: simulado sin "type" pero con simulatedProfileId
    expect(phrase('MEMBER_REMOVED', { simulatedProfileId: 4, name: 'Abuela' }))
      .toBe('Ana López quitó el perfil simulado Abuela')
    // formato viejo de 010: registrado con solo el id
    expect(phrase('MEMBER_REMOVED', { userId: 15 })).toBe('Ana López quitó a un miembro del grupo')
  })

  it('describe salidas, permisos, foto y tipos desconocidos', () => {
    expect(phrase('MEMBER_LEFT', {})).toBe('Ana López abandonó el grupo')
    expect(phrase('PERMISSION_CHANGED', { fields: ['permissions'] }))
      .toBe('Ana López cambió los permisos del grupo')
    expect(phrase('PHOTO_CHANGED', {})).toBe('Ana López cambió la foto del grupo')
    expect(phrase('GROUP_ARCHIVED', {})).toBe('Ana López realizó una acción en el grupo')
    expect(describeActivity(undefined)).toEqual({ actor: 'Alguien', text: 'realizó una acción en el grupo' })
  })

  it('arma el nombre del actor sin "null" ni espacios sobrantes', () => {
    expect(actorName(null)).toBe('Alguien')
    expect(actorName({ firstName: 'Juan', lastName: null })).toBe('Juan')
    expect(actorName({ firstName: ' Juan ', lastName: '  ' })).toBe('Juan')
    expect(actorName({ firstName: '', lastName: '' })).toBe('Alguien')
  })
})

describe('describeActivity: gastos y pagos (014 US2 / 022 US8)', () => {
  it('describe gastos viejos (sin pagador) con monto en pesos y descripción opcional (T061)', () => {
    const withDescription = phrase('EXPENSE_CREATED', { amount: '1500.00', currency: 'ARS', description: 'Súper' })
    expect(withDescription).toMatch(/^Ana López registró un gasto de \$\s?1\.500,00 «Súper»$/)
    expect(phrase('EXPENSE_CREATED', { amount: '1500.00', currency: 'ARS' }))
      .toMatch(/^Ana López registró un gasto de \$\s?1\.500,00$/)
    expect(phrase('EXPENSE_CREATED', {})).toBe('Ana López registró un gasto')
  })

  it('incluye al pagador en EXPENSE_CREATED y muestra a quien registró y al pagador cuando son distintos o iguales (T061)', () => {
    const differentPayer = phrase('EXPENSE_CREATED', {
      expenseId: 10,
      amount: '1500.00',
      currency: 'ARS',
      description: 'Súper',
      payerUserId: 15,
      payerName: 'Juan Pérez',
    })
    expect(differentPayer)
      .toMatch(/^Ana López registró un gasto de \$\s?1\.500,00 «Súper» pagado por Juan Pérez$/)

    const samePayer = phrase('EXPENSE_CREATED', {
      expenseId: 11,
      amount: '1500.00',
      currency: 'ARS',
      description: 'Súper',
      payerUserId: 7,
      payerName: 'Ana López',
    })
    expect(samePayer)
      .toMatch(/^Ana López registró un gasto de \$\s?1\.500,00 «Súper» \(pagó Ana López\)$/)
  })

  it('describe pagos con quién paga y quién recibe (PAYMENT_MADE y PAYMENT_REGISTERED)', () => {
    expect(phrase('PAYMENT_MADE', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez', toName: 'Ana López' }))
      .toMatch(/^Ana López registró un pago de \$\s?500,00 de Juan Pérez a Ana López$/)
    expect(phrase('PAYMENT_REGISTERED', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez', toName: 'Ana López' }))
      .toMatch(/^Ana López registró un pago de \$\s?500,00 de Juan Pérez a Ana López$/)
    expect(phrase('PAYMENT_MADE', { amount: '500', currency: 'ARS', toName: 'Ana' }))
      .toMatch(/registró un pago de \$\s?500,00 a Ana$/)
    expect(phrase('PAYMENT_MADE', { fromName: 'Juan' })).toBe('Ana López registró un pago de Juan')
  })

  it('describe transiciones de estado de pagos y deudas y propuesta de liquidación (T048, T049)', () => {
    expect(phrase('PAYMENT_CONFIRMED', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez', toName: 'Ana López' }))
      .toMatch(/^Ana López confirmó el pago de \$\s?500,00 de Juan Pérez a Ana López$/)
    expect(phrase('PAYMENT_CONFIRMED', {})).toBe('Ana López confirmó un pago')

    expect(phrase('PAYMENT_REJECTED', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez', toName: 'Ana López' }))
      .toMatch(/^Ana López rechazó el pago de \$\s?500,00 de Juan Pérez a Ana López$/)
    expect(phrase('PAYMENT_REJECTED', {})).toBe('Ana López rechazó un pago')

    expect(phrase('DEBT_OVERDUE', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez', toName: 'Ana López' }, null))
      .toMatch(/^Sistema venció la deuda de \$\s?500,00 de Juan Pérez con Ana López$/)
    expect(phrase('DEBT_OVERDUE', {}, null)).toBe('Sistema venció una deuda')

    expect(phrase('LIQUIDATION_PROPOSED', { transferCount: 2, currency: 'ARS' }))
      .toBe('Ana López generó una propuesta de liquidación (2 transferencias)')
    expect(phrase('LIQUIDATION_PROPOSED', { transferCount: 1, currency: 'ARS' }))
      .toBe('Ana López generó una propuesta de liquidación (1 transferencia)')
    expect(phrase('LIQUIDATION_PROPOSED', { transferCount: 0, currency: 'ARS' }))
      .toBe('Ana López generó una propuesta de liquidación')

    expect(phrase('DEBT_REMINDER_SENT', { amount: '500', currency: 'ARS', fromName: 'Juan Pérez' }, null))
      .toMatch(/^Sistema envió el recordatorio de la deuda de \$\s?500,00 a Juan Pérez$/)
    expect(phrase('DEBT_REMINDER_SENT', {}, null)).toBe('Sistema envió un recordatorio de deuda')

    expect(phrase('PAYER_DUE_NOTICE_SENT', { concept: 'Súper', payerName: 'Ana López' }, null))
      .toBe('Sistema envió el aviso de vencimiento del gasto «Súper» a Ana López')
    expect(phrase('PAYER_DUE_NOTICE_SENT', {}, null))
      .toBe('Sistema envió el aviso de vencimiento de un gasto')

    // 028: las ocurrencias de una serie las crea el job, sin actor humano.
    expect(phrase('EXPENSE_CREATED', { amount: '1500.00', currency: 'ARS' }, null))
      .toMatch(/^Sistema registró un gasto de \$\s?1\.500,00$/)
  })

  it('formatea montos y tolera monedas desconocidas o datos faltantes', () => {
    expect(formatMoney('10', 'USD')).toMatch(/US\$\s?10,00/)
    expect(formatMoney('10', 'NOPE1')).toBe('NOPE1 10')
    expect(formatMoney('10', '')).toBe('10')
    expect(formatMoney('abc', 'ARS')).toBeNull()
    expect(formatMoney(null, 'ARS')).toBeNull()
    expect(formatMoney('', 'ARS')).toBeNull()
  })
})

describe('agrupación por día (014 FR-015)', () => {
  it('agrupa por día de Argentina y muestra la hora', () => {
    const entries = [
      { id: 3, createdAt: '2026-11-03T15:20:00Z' },
      { id: 2, createdAt: '2026-11-03T12:00:00Z' },
      // 02:30 UTC del 3 = 23:30 del 2 en Argentina
      { id: 1, createdAt: '2026-11-03T02:30:00Z' },
    ]

    const groups = groupByDay(entries)

    expect(groups.map((group) => group.key)).toEqual(['2026-11-03', '2026-11-02'])
    expect(groups[0].entries.map((entry) => entry.id)).toEqual([3, 2])
    expect(groups[0].label).toMatch(/^Martes,? 3 de noviembre de 2026$/)
    expect(formatTime('2026-11-03T15:20:00Z')).toMatch(/12:20/)
    expect(dayKey('2026-11-03T02:30:00Z')).toBe('2026-11-02')
  })

  it('tolera fechas inválidas', () => {
    expect(dayKey('no es fecha')).toBe('sin-fecha')
    expect(formatDay('no es fecha')).toBe('Sin fecha')
    expect(formatTime(undefined)).toBe('')
  })

  it('expone los filtros del contrato', () => {
    expect(ACTIVITY_FILTERS.map((option) => option.label)).toEqual([
      'Toda la actividad', 'Altas', 'Bajas', 'Gastos', 'Pagos', 'Recordatorios', 'Recurrencia', 'Cambios del grupo',
    ])
    expect(ACTIVITY_FILTERS.find((option) => option.value === 'REMOVED').eventTypes)
      .toEqual(['MEMBER_REMOVED', 'MEMBER_LEFT'])
    // 022 T076: los filtros incluyen los eventos nuevos
    expect(ACTIVITY_FILTERS.find((option) => option.value === 'EXPENSES').eventTypes)
      .toEqual(['EXPENSE_CREATED', 'EXPENSE_EDITED', 'EXPENSE_DELETED'])
    expect(ACTIVITY_FILTERS.find((option) => option.value === 'PAYMENTS').eventTypes).toEqual([
      'PAYMENT_MADE', 'PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED', 'PAYMENT_REJECTED',
      'DEBT_OVERDUE', 'LIQUIDATION_PROPOSED',
    ])
    // 030: los avisos se filtran junto con los recordatorios
    expect(ACTIVITY_FILTERS.find((option) => option.value === 'REMINDERS').eventTypes)
      .toEqual(['DEBT_REMINDER_SENT', 'PAYER_DUE_NOTICE_SENT', 'DEBT_WHISTLED'])
    expect(ACTIVITY_FILTERS.find((option) => option.value === 'RECURRENCE').eventTypes)
      .toEqual(['RECURRENCE_PAUSED', 'RECURRENCE_RESUMED', 'RECURRENCE_FINISHED'])
  })
})

describe('describeActivity: edición y borrado de gastos y eventos viejos (022 T076)', () => {
  it('describe EXPENSE_EDITED y EXPENSE_DELETED, con o sin descripción', () => {
    expect(phrase('EXPENSE_EDITED', { expenseId: 12 })).toBe('Ana López editó un gasto')
    expect(phrase('EXPENSE_EDITED', { expenseId: 12, description: 'Súper' }))
      .toBe('Ana López editó el gasto «Súper»')
    expect(phrase('EXPENSE_DELETED', { expenseId: 12 })).toBe('Ana López eliminó un gasto')
    expect(phrase('EXPENSE_DELETED', { expenseId: 12, description: 'Súper' }))
      .toBe('Ana López eliminó el gasto «Súper»')
  })

  it('los eventos nuevos sin detalles ni actor no rompen la frase', () => {
    expect(describeActivity({ eventType: 'EXPENSE_EDITED' })).toEqual({ actor: 'Alguien', text: 'editó un gasto' })
    expect(describeActivity({ eventType: 'EXPENSE_DELETED', details: null }))
      .toEqual({ actor: 'Alguien', text: 'eliminó un gasto' })
  })

  it('DEBT_OVERDUE sin actor se atribuye al Sistema y con actor conserva el nombre', () => {
    expect(describeActivity({ eventType: 'DEBT_OVERDUE', actor: null, details: {} }))
      .toEqual({ actor: 'Sistema', text: 'venció una deuda' })
    expect(describeActivity({ eventType: 'DEBT_OVERDUE', actor: ANA, details: {} }).actor).toBe('Ana López')
  })

  it('un evento viejo sin los campos nuevos y un tipo desconocido siguen mostrándose', () => {
    expect(phrase('EXPENSE_CREATED', { amount: '10.00', currency: 'ARS' })).toMatch(/^Ana López registró un gasto de .*10,00$/)
    expect(phrase('PAYMENT_MADE', { amount: '500', currency: 'ARS' })).toContain('registró un pago de')
    expect(phrase('EVENTO_DEL_FUTURO', { x: 1 })).toBe('Ana López realizó una acción en el grupo')
    expect(describeActivity(undefined)).toEqual({ actor: 'Alguien', text: 'realizó una acción en el grupo' })
  })
})

describe('expenseLinkId / deletedExpenseIds (022 T076)', () => {
  const entry = (eventType, details) => ({ eventType, details })

  it('enlaza los eventos con gasto asociado que traen expenseId', () => {
    for (const type of ['EXPENSE_CREATED', 'EXPENSE_EDITED', 'PAYMENT_MADE', 'PAYMENT_REGISTERED',
      'PAYMENT_CONFIRMED', 'PAYMENT_REJECTED', 'DEBT_OVERDUE', 'DEBT_REMINDER_SENT',
      'PAYER_DUE_NOTICE_SENT', 'RECURRENCE_PAUSED', 'RECURRENCE_RESUMED', 'RECURRENCE_FINISHED',
      'DEBT_WHISTLED']) {
      expect(expenseLinkId(entry(type, { expenseId: 12 }))).toBe(12)
    }
  })

  it('describe eventos de recurrencia con descripción opcional', () => {
    expect(phrase('RECURRENCE_PAUSED', { expenseId: 7, description: 'Alquiler' }))
      .toBe('Ana López pausó el gasto recurrente «Alquiler»')
    expect(phrase('RECURRENCE_RESUMED', { expenseId: 7 }))
      .toBe('Ana López reanudó un gasto recurrente')
    expect(phrase('RECURRENCE_FINISHED', { expenseId: 7, description: 'Internet' }))
      .toBe('Ana López finalizó el gasto recurrente «Internet»')
  })

  it('no enlaza EXPENSE_DELETED, tipos sin gasto ni eventos viejos sin expenseId', () => {
    expect(expenseLinkId(entry('EXPENSE_DELETED', { expenseId: 12 }))).toBeNull()
    expect(expenseLinkId(entry('LIQUIDATION_PROPOSED', { expenseId: 12 }))).toBeNull()
    expect(expenseLinkId(entry('MEMBER_ADDED', { expenseId: 12 }))).toBeNull()
    expect(expenseLinkId(entry('EXPENSE_CREATED', { amount: '10.00' }))).toBeNull()
    expect(expenseLinkId(entry('EXPENSE_CREATED'))).toBeNull()
    expect(expenseLinkId(undefined)).toBeNull()
  })

  it('no enlaza los gastos que las entradas cargadas muestran como borrados', () => {
    const entries = [
      entry('EXPENSE_DELETED', { expenseId: 12 }),
      entry('EXPENSE_EDITED', { expenseId: 12 }),
      entry('EXPENSE_CREATED', { expenseId: 12 }),
      entry('EXPENSE_CREATED', { expenseId: 13 }),
    ]
    const deleted = deletedExpenseIds(entries)
    expect([...deleted]).toEqual(['12'])
    expect(entries.map((item) => expenseLinkId(item, deleted))).toEqual([null, null, null, 13])
    expect(deletedExpenseIds(undefined).size).toBe(0)
  })
})

describe('describeActivity: avisos (030 T027)', () => {
  it('describe el aviso a nombre del acreedor, con el deudor, el monto y el concepto', () => {
    expect(phrase('DEBT_WHISTLED', {
      whistleId: 1, debtId: 42, expenseId: 9, amount: '8000.00', currency: 'ARS',
      fromName: 'Juan Pérez', toName: 'Ana López', description: 'Cena',
    })).toBe(`Ana López le avisó a Juan Pérez por ${formatMoney('8000.00', 'ARS')} (Cena)`)
  })

  it('sin concepto omite el paréntesis y sin datos sigue siendo legible', () => {
    expect(phrase('DEBT_WHISTLED', { amount: '500', currency: 'USD', fromName: 'Juan Pérez' }))
      .toBe(`Ana López le avisó a Juan Pérez por ${formatMoney('500', 'USD')}`)
    expect(phrase('DEBT_WHISTLED', {})).toBe('Ana López le avisó a alguien por una deuda')
  })

  it('el actor es el acreedor, nunca "Sistema", y un tipo desconocido conserva la frase por defecto', () => {
    expect(describeActivity({ eventType: 'DEBT_WHISTLED', details: {}, actor: null }).actor).toBe('Alguien')
    expect(phrase('ALGO_NUEVO', {})).toBe('Ana López realizó una acción en el grupo')
  })
})
