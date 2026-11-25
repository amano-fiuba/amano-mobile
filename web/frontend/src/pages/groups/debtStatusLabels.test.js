import { describe, expect, it } from 'vitest'
import {
  DEBT_STATUS_UNKNOWN,
  debtStatusLabel,
  debtStatusModifier,
  isOpenDebtStatus,
  isPayableDebtStatus,
  isSettledDebtStatus,
} from './debtStatusLabels'
import { expensePermissions } from './expensePermissions'
import { participantKey, toParticipant, userIdOf } from './participantKeys'

// 017 T032: labels of the debt states (FR-023), UI permissions (FR-007) and
// participant keys (research.md D7).

describe('debtStatusLabel (017)', () => {
  it('traduce los tres estados y formatea el saldo del pago parcial', () => {
    expect(debtStatusLabel('PENDING', '3333.33')).toBe('Pendiente')
    expect(debtStatusLabel('PARTIALLY_PAID', '1234.5')).toBe('Pago parcial · faltan $ 1.234,50')
    expect(debtStatusLabel('PARTIALLY_PAID')).toBe('Pago parcial')
    expect(debtStatusLabel('PAID', '0.00')).toBe('Pagada')
  })

  it('un estado desconocido no rompe', () => {
    expect(debtStatusLabel('CANCELLED')).toBe(DEBT_STATUS_UNKNOWN)
    expect(debtStatusLabel(undefined)).toBe(DEBT_STATUS_UNKNOWN)
  })

  it('cada estado tiene su modificador de estilo', () => {
    expect(debtStatusModifier('PENDING')).toBe('pending')
    expect(debtStatusModifier('PARTIALLY_PAID')).toBe('partial')
    expect(debtStatusModifier('PAID')).toBe('paid')
    expect(debtStatusModifier('OTHER')).toBe('unknown')
  })
})

describe('debtStatusLabel: estados de la 022', () => {
  it('traduce los seis estados sin mostrar nunca el valor del enum', () => {
    const labels = {
      PENDING: 'Pendiente',
      PARTIALLY_PAID: 'Pago parcial · faltan $ 10,00',
      PAYMENT_REPORTED: 'Pago informado',
      PAID: 'Pagada',
      VERIFIED: 'Pago verificado',
      OVERDUE: 'Vencida',
    }
    for (const [status, label] of Object.entries(labels)) {
      expect(debtStatusLabel(status, '10.00')).toBe(label)
      expect(debtStatusLabel(status, '10.00')).not.toMatch(/^[A-Z_]+$/)
    }
  })

  it('cada estado nuevo tiene su modificador de estilo', () => {
    expect(debtStatusModifier('PAYMENT_REPORTED')).toBe('reported')
    expect(debtStatusModifier('VERIFIED')).toBe('verified')
    expect(debtStatusModifier('OVERDUE')).toBe('overdue')
  })

  it('abiertas: PENDING, PARTIALLY_PAID, PAYMENT_REPORTED y OVERDUE; saldadas: solo PAID y VERIFIED', () => {
    for (const status of ['PENDING', 'PARTIALLY_PAID', 'PAYMENT_REPORTED', 'OVERDUE']) {
      expect(isOpenDebtStatus(status)).toBe(true)
      expect(isSettledDebtStatus(status)).toBe(false)
    }
    for (const status of ['PAID', 'VERIFIED']) {
      expect(isOpenDebtStatus(status)).toBe(false)
      expect(isSettledDebtStatus(status)).toBe(true)
    }
    expect(isOpenDebtStatus('OTRO')).toBe(false)
    expect(isSettledDebtStatus(undefined)).toBe(false)
  })

  it('se puede pagar una deuda pendiente, parcial o vencida, pero no una informada ni una saldada', () => {
    expect(['PENDING', 'PARTIALLY_PAID', 'OVERDUE'].every(isPayableDebtStatus)).toBe(true)
    expect(['PAYMENT_REPORTED', 'PAID', 'VERIFIED', 'OTRO'].some(isPayableDebtStatus)).toBe(false)
  })
})

describe('expensePermissions (017)', () => {
  it('sin grupo no permite nada', () => {
    expect(expensePermissions(null)).toEqual({ canCreateExpenses: false, canExpenseForOthers: false })
  })

  it('el ADMIN siempre puede todo, aunque las casillas lo prohíban a los MEMBER', () => {
    const group = {
      currentUserRole: 'ADMIN',
      permissions: { membersCannotMakeExpenses: true, membersCanGenerateExpensesForOthers: false },
    }
    expect(expensePermissions(group)).toEqual({ canCreateExpenses: true, canExpenseForOthers: true })
  })

  it.each([
    [{ membersCannotMakeExpenses: false, membersCanGenerateExpensesForOthers: false }, true, false],
    [{ membersCannotMakeExpenses: false, membersCanGenerateExpensesForOthers: true }, true, true],
    [{ membersCannotMakeExpenses: true, membersCanGenerateExpensesForOthers: true }, false, false],
    [{ membersCannotMakeExpenses: true, membersCanGenerateExpensesForOthers: false }, false, false],
    [undefined, true, false],
  ])('MEMBER con %o → crear %s, pagador ajeno %s', (permissions, create, others) => {
    expect(expensePermissions({ currentUserRole: 'MEMBER', permissions })).toEqual({
      canCreateExpenses: create,
      canExpenseForOthers: others,
    })
  })
})

describe('participantKeys (017)', () => {
  it('distingue usuarios y perfiles simulados con el mismo id', () => {
    expect(participantKey({ userId: 7, simulatedProfileId: null })).toBe('u:7')
    expect(participantKey({ userId: null, simulatedProfileId: 7 })).toBe('s:7')
  })

  it('arma el participante del cuerpo y el id del pagador', () => {
    expect(toParticipant('u:7')).toEqual({ type: 'REGISTERED', userId: 7 })
    expect(toParticipant('s:4')).toEqual({ type: 'SIMULATED', simulatedProfileId: 4 })
    expect(userIdOf('u:15')).toBe(15)
    expect(userIdOf('s:4')).toBeNull()
    expect(userIdOf(null)).toBeNull()
  })
})
