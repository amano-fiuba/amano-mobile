import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  getGroup: vi.fn(),
}))
vi.mock('../../api/groupExpensesClient', async (importOriginal) => ({
  ...await importOriginal(),
  getPendingDebts: vi.fn(),
  getGroupBalances: vi.fn(),
  getSettlementProposal: vi.fn(),
}))
vi.mock('../../api/paymentsClient', async (importOriginal) => ({
  ...await importOriginal(),
  registerDebtPayment: vi.fn(),
  confirmPayment: vi.fn(),
  rejectPayment: vi.fn(),
  getPaymentsPendingValidation: vi.fn(),
}))

const setUser = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 }, setUser }),
}))
const showSnackbar = vi.fn()
vi.mock('../../components/Snackbar', () => ({ useSnackbar: () => showSnackbar }))

import { getGroup } from '../../api/groupsClient'
import {
  GROUP_DEBTS_LOAD_ERROR_MESSAGE,
  getGroupBalances,
  getPendingDebts,
  getSettlementProposal,
} from '../../api/groupExpensesClient'
import {
  PAYMENT_DECISION_NETWORK_ERROR_MESSAGE,
  confirmPayment,
  getPaymentsPendingValidation,
  registerDebtPayment,
  rejectPayment,
} from '../../api/paymentsClient'
import GroupDebtsView, { GROUP_LOAD_ERROR_MESSAGE, NOT_A_MEMBER_MESSAGE } from './GroupDebtsView'
import {
  ALREADY_REPORTED_MESSAGE,
  NO_OPEN_DEBTS_MESSAGE,
  PAYMENT_REPORTED_MESSAGE,
  PAYMENT_SUCCESS_MESSAGE,
  REPORTED_NOTE,
} from '../../components/groups/MyDebtsPanel'
import { NO_BALANCES_MESSAGE } from '../../components/groups/BalancesPanel'
import { INFORMATIVE_LABEL, NO_PROPOSAL_MESSAGE, PROPOSAL_NOTE } from '../../components/groups/SettlementPanel'
import { VALIDATION_NOTICE } from '../../components/groups/PaymentConfirmDialog'
import {
  NO_PENDING_PAYMENTS_MESSAGE,
  PAYMENT_CONFIRMED_MESSAGE,
  PAYMENT_REJECTED_MESSAGE,
} from '../../components/groups/PendingPaymentsPanel'
import { AMOUNT_FORMAT, AMOUNT_POSITIVE, AMOUNT_REQUIRED } from '../../validation/expenseValidation'

// 022 T074/T075: debts, balances, settlement proposal and payments of a group.

const group = (role = 'MEMBER', permissions = {}) => ({
  ok: true,
  group: { id: 3, name: 'Depto', currentUserRole: role, permissions },
})

const debt = (over) => ({
  debtId: 31,
  debtorName: 'Ana López',
  creditorName: 'Juan Pérez',
  amount: 3333.33,
  paidAmount: 0,
  outstanding: 3333.33,
  status: 'PENDING',
  expenseId: 12,
  shareId: 5,
  currency: 'ARS',
  convertedAmount: null,
  convertedCurrency: null,
  debtorUserId: 7,
  creditorUserId: 15,
  ...over,
})

const OWE = debt({})
const OWED_USD = debt({
  debtId: 32, debtorName: 'Juan Pérez', creditorName: 'Ana López', amount: 50, outstanding: 50,
  status: 'OVERDUE', currency: 'USD', convertedAmount: 62525, convertedCurrency: 'ARS', expenseId: 13,
  debtorUserId: 15, creditorUserId: 7,
})
const REPORTED = debt({ debtId: 33, status: 'PAYMENT_REPORTED', expenseId: 14 })
const PARTIAL = debt({ debtId: 34, status: 'PARTIALLY_PAID', paidAmount: 1000, outstanding: 2333.33, expenseId: 15 })

const ok = (data) => ({ ok: true, data })

function renderView(initialEntry = '/groups/3/debts') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/groups/:id/debts" element={<GroupDebtsView />} />
        <Route path="/groups/:id/expenses/:expenseId" element={<p>Detalle del gasto</p>} />
        <Route path="/groups/:id" element={<p>Pantalla del grupo</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const tab = (name) => screen.getByRole('tab', { name })
const panel = () => screen.getByTestId('group-debts-panel')

beforeEach(() => {
  for (const mock of [getGroup, getPendingDebts, getGroupBalances, getSettlementProposal,
    registerDebtPayment, confirmPayment, rejectPayment, getPaymentsPendingValidation, setUser, showSnackbar]) {
    mock.mockReset()
  }
  getGroup.mockResolvedValue(group())
  getPendingDebts.mockResolvedValue(ok([OWE]))
  getGroupBalances.mockResolvedValue(ok({ groupId: 3, currencies: [] }))
  getSettlementProposal.mockResolvedValue(ok({ groupId: 3, proposals: [] }))
  getPaymentsPendingValidation.mockResolvedValue({ ok: true, payments: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GroupDebtsView: pestañas y rol (022 T074)', () => {
  it('un miembro ve tres pestañas, con la primera seleccionada, y no ve "Pagos por validar"', async () => {
    renderView()

    expect(await screen.findByRole('tablist', { name: 'Secciones de deudas' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((node) => node.textContent)).toEqual([
      'Mis deudas pendientes', 'Saldos', 'Propuesta de liquidación',
    ])
    expect(tab('Mis deudas pendientes')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('tab', { name: 'Pagos por validar' })).not.toBeInTheDocument()
    expect(getPaymentsPendingValidation).not.toHaveBeenCalled()
    expect(panel()).toHaveAttribute('aria-labelledby', 'debts-tab-debts')
  })

  it('un administrador también ve "Pagos por validar"', async () => {
    getGroup.mockResolvedValue(group('ADMIN'))
    renderView()

    expect(await screen.findByRole('tab', { name: 'Pagos por validar' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
  })

  it('cambia de panel con el mouse y con las flechas, Inicio y Fin, moviendo el foco', async () => {
    getGroup.mockResolvedValue(group('ADMIN'))
    const user = userEvent.setup()
    renderView()

    await user.click(await screen.findByRole('tab', { name: 'Saldos' }))
    expect(tab('Saldos')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Saldos')).toHaveAttribute('tabindex', '0')
    expect(tab('Mis deudas pendientes')).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{ArrowRight}')
    expect(tab('Propuesta de liquidación')).toHaveFocus()
    expect(tab('Propuesta de liquidación')).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(tab('Pagos por validar')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(tab('Mis deudas pendientes')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(tab('Pagos por validar')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Mis deudas pendientes')).toHaveFocus()
  })

  it('un grupo inexistente muestra el mensaje neutral sin reintento; un error de red permite reintentar', async () => {
    getGroup.mockResolvedValueOnce({ ok: false, status: 404 })
    const { unmount } = renderView()
    const alert = await screen.findByTestId('group-debts-load-error')
    expect(alert).toHaveTextContent(NOT_A_MEMBER_MESSAGE)
    expect(within(alert).queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    unmount()

    const user = userEvent.setup()
    getGroup.mockResolvedValueOnce({ ok: false, network: true })
    renderView()
    const retry = await screen.findByTestId('group-debts-load-error')
    expect(retry).toHaveTextContent(GROUP_LOAD_ERROR_MESSAGE)
    await user.click(within(retry).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('tablist')).toBeInTheDocument()
  })

  it('un 401 al cargar el grupo cierra la sesión', async () => {
    getGroup.mockResolvedValue({ ok: false, status: 401 })
    renderView()
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})

describe('GroupDebtsView: mis deudas pendientes (022 T074)', () => {
  it('muestra cada deuda con su sentido, su estado en voseo y el monto original y convertido', async () => {
    getPendingDebts.mockResolvedValue(ok([OWE, OWED_USD, REPORTED, PARTIAL]))
    renderView()

    const rows = await screen.findAllByTestId('my-debt-row')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('Le debés a Juan Pérez')
    expect(rows[0]).toHaveTextContent('Pendiente')
    expect(within(rows[0]).getByTestId('converted-amount')).toHaveTextContent('$ 3.333,33 ARS')
    expect(rows[1]).toHaveTextContent('Juan Pérez te debe')
    expect(rows[1]).toHaveTextContent('Vencida')
    expect(within(rows[1]).getByTestId('converted-amount')).toHaveTextContent('$ 50,00 USD · $ 62.525,00 ARS')
    expect(rows[2]).toHaveTextContent('Pago informado')
    expect(rows[3]).toHaveTextContent('Pago parcial · faltan $ 2.333,33')
    for (const raw of ['PENDING', 'OVERDUE', 'PAYMENT_REPORTED', 'PARTIALLY_PAID']) {
      expect(panel()).not.toHaveTextContent(raw)
    }
  })

  it('"Registrar pago" aparece en pendientes, parciales y vencidas, pero no en una deuda informada', async () => {
    getPendingDebts.mockResolvedValue(ok([OWE, OWED_USD, REPORTED, PARTIAL]))
    renderView()

    const rows = await screen.findAllByTestId('my-debt-row')
    expect(within(rows[0]).getByRole('button', { name: /Registrar pago/ })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: /Registrar pago/ })).toBeInTheDocument()
    expect(within(rows[3]).getByRole('button', { name: /Registrar pago/ })).toBeInTheDocument()
    expect(within(rows[2]).queryByRole('button', { name: /Registrar pago/ })).not.toBeInTheDocument()
    expect(within(rows[2]).getByTestId('reported-note')).toHaveTextContent(REPORTED_NOTE)
  })

  it('cada deuda enlaza a su gasto', async () => {
    renderView()
    const row = await screen.findByTestId('my-debt-row')
    expect(within(row).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/3/expenses/12')
  })

  it('sin deudas muestra el mensaje vacío', async () => {
    getPendingDebts.mockResolvedValue(ok([]))
    renderView()
    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_OPEN_DEBTS_MESSAGE)
  })

  it('un error muestra el mensaje y reintenta', async () => {
    getPendingDebts.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderView()
    const alert = await screen.findByTestId('debts-error')
    expect(alert).toHaveTextContent(GROUP_DEBTS_LOAD_ERROR_MESSAGE)

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('my-debt-row')).toBeInTheDocument()
    expect(getPendingDebts).toHaveBeenCalledTimes(2)
  })

  it('muestra el estado de carga mientras espera', async () => {
    let resolve
    getPendingDebts.mockReturnValue(new Promise((done) => { resolve = done }))
    renderView()
    await screen.findByRole('tablist')
    expect(within(panel()).getByText('Cargando…')).toBeInTheDocument()
    resolve(ok([OWE]))
    expect(await screen.findByTestId('my-debt-row')).toBeInTheDocument()
  })
})

describe('GroupDebtsView: "Avisar" en mis deudas pendientes (030 T011)', () => {
  const OWED_REPORTED = debt({
    debtId: 35, debtorName: 'Juan Pérez', creditorName: 'Ana López', status: 'PAYMENT_REPORTED',
    debtorUserId: 15, creditorUserId: 7,
  })
  const OWED_BY_SIMULATED = debt({
    debtId: 36, debtorName: 'Abuela', creditorName: 'Ana López', status: 'PENDING',
    debtorUserId: null, creditorUserId: 7,
  })
  const OWED_PARTIAL = debt({
    debtId: 37, debtorName: 'Carla Gómez', creditorName: 'Ana López', status: 'PARTIALLY_PAID',
    paidAmount: 1000, outstanding: 2333.33, debtorUserId: 22, creditorUserId: 7,
  })

  it('aparece solo cuando la persona es la acreedora y la deuda tiene saldo avisable', async () => {
    getPendingDebts.mockResolvedValue(ok([OWE, OWED_USD, REPORTED, OWED_REPORTED, OWED_BY_SIMULATED, OWED_PARTIAL]))
    renderView()

    const rows = await screen.findAllByTestId('my-debt-row')
    const whistle = (row) => within(row).queryByRole('button', { name: /^Avisar a / })
    expect(whistle(rows[0])).not.toBeInTheDocument()
    expect(whistle(rows[1])).toHaveAccessibleName('Avisar a Juan Pérez')
    expect(whistle(rows[1])).toBeEnabled()
    expect(whistle(rows[2])).not.toBeInTheDocument()
    expect(whistle(rows[3])).not.toBeInTheDocument()
    expect(whistle(rows[4])).toBeDisabled()
    expect(rows[4]).toHaveTextContent('Los perfiles simulados no reciben avisos')
    expect(whistle(rows[5])).toBeEnabled()
  })
})

describe('GroupDebtsView: saldos (022 T074)', () => {
  const BALANCES = {
    groupId: 3,
    currencies: [
      {
        currency: 'ARS',
        total: 0,
        balances: [
          { memberId: 7, memberName: 'Ana López', memberType: 'REGISTERED', netBalance: 6666.66 },
          { memberId: 15, memberName: 'Juan Pérez', memberType: 'REGISTERED', netBalance: -3333.33 },
          { memberId: 4, memberName: 'Abuela', memberType: 'SIMULATED', netBalance: -3333.33 },
        ],
      },
      { currency: 'USD', total: 0, balances: [{ memberId: 7, memberName: 'Ana López', memberType: 'REGISTERED', netBalance: 0 }] },
    ],
  }

  it('lista los saldos de cada moneda por separado, con quién debe y quién tiene a favor', async () => {
    getGroupBalances.mockResolvedValue(ok(BALANCES))
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Saldos' }))

    expect(await screen.findByRole('region', { name: 'Saldos en ARS' })).toBeInTheDocument()
    const rows = screen.getAllByTestId('balance-row')
    expect(rows[0]).toHaveTextContent('Ana López')
    expect(rows[0]).toHaveTextContent('A favor $ 6.666,66')
    expect(rows[1]).toHaveTextContent('Debe $ 3.333,33')
    expect(rows[2]).toHaveTextContent('Abuela (perfil simulado)')
    expect(within(screen.getByRole('region', { name: 'Saldos en USD' })).getByTestId('balance-row'))
      .toHaveTextContent('Al día')
  })

  it('sin saldos y con error muestra los mensajes', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Saldos' }))
    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_BALANCES_MESSAGE)

    getGroupBalances.mockResolvedValueOnce({ ok: false, network: true })
    await user.click(tab('Mis deudas pendientes'))
    await user.click(tab('Saldos'))
    expect(await screen.findByTestId('debts-error')).toHaveTextContent(GROUP_DEBTS_LOAD_ERROR_MESSAGE)
  })
})

describe('GroupDebtsView: propuesta de liquidación (022 T074)', () => {
  const PROPOSAL = {
    groupId: 3,
    proposals: [{
      currency: 'ARS',
      transfers: [
        { fromMemberId: 15, fromMemberName: 'Juan Pérez', fromMemberType: 'REGISTERED', toMemberId: 7, toMemberName: 'Ana López', toMemberType: 'REGISTERED', amount: 3333.33, informative: false },
        { fromMemberId: 4, fromMemberName: 'Abuela', fromMemberType: 'SIMULATED', toMemberId: 7, toMemberName: 'Ana López', toMemberType: 'REGISTERED', amount: 3333.33, informative: true },
      ],
      summary: { totalTransferred: 6666.66, totalNetBalances: 6666.66, membersSettled: 3, transferCount: 2 },
    }],
  }

  it('muestra las transferencias, rotula las de personas simuladas como informativas y aclara que no genera pagos', async () => {
    getSettlementProposal.mockResolvedValue(ok(PROPOSAL))
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Propuesta de liquidación' }))

    expect(await screen.findByText(PROPOSAL_NOTE)).toBeInTheDocument()
    const rows = screen.getAllByTestId('transfer-row')
    expect(rows[0]).toHaveTextContent('Juan Pérez le paga a Ana López')
    expect(rows[0]).toHaveTextContent('$ 3.333,33 ARS')
    expect(within(rows[0]).queryByTestId('informative-note')).not.toBeInTheDocument()
    expect(within(rows[1]).getByTestId('informative-note')).toHaveTextContent(INFORMATIVE_LABEL)
    expect(screen.getByText('2 transferencias')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pagar|registrar/i })).not.toBeInTheDocument()
  })

  it('sin transferencias y con error muestra los mensajes', async () => {
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Propuesta de liquidación' }))
    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_PROPOSAL_MESSAGE)

    getSettlementProposal.mockResolvedValueOnce({ ok: false, status: 500 })
    await user.click(tab('Saldos'))
    await user.click(tab('Propuesta de liquidación'))
    expect(await screen.findByTestId('debts-error')).toBeInTheDocument()
  })
})

describe('GroupDebtsView: registrar un pago parcial o total (022 T075/T082)', () => {
  const payButton = () => screen.getByRole('button', { name: /Registrar pago: / })
  const dialog = () => screen.getByRole('dialog')
  const amountInput = () => within(dialog()).getByLabelText('Monto (ARS)')
  let uuids

  beforeEach(() => {
    uuids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333']
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => uuids.shift())
  })

  async function openDialog(user) {
    renderView()
    await user.click(await screen.findByRole('button', { name: /Registrar pago: / }))
  }

  async function typeAmount(user, value) {
    const input = amountInput()
    await user.clear(input)
    if (value) await user.type(input, value)
  }

  it('pide confirmación con el monto editable en el saldo pendiente, la moneda y el saldo restante, y NO registra hasta confirmar (control negativo)', async () => {
    const user = userEvent.setup()
    await openDialog(user)

    expect(dialog()).toHaveTextContent('$ 3.333,33 ARS')
    expect(amountInput()).toHaveValue('3.333,33')
    expect(within(dialog()).getByTestId('payment-summary')).toHaveTextContent('Vas a registrar un pago de $ 3.333,33 ARS')
    expect(within(dialog()).getByTestId('remaining-balance')).toHaveTextContent('Saldo restante: $ 0,00 ARS')
    expect(dialog()).toHaveFocus()
    expect(registerDebtPayment).not.toHaveBeenCalled()
  })

  it('sobre una deuda con pago parcial previo propone por defecto el saldo pendiente (amount − paidAmount)', async () => {
    getPendingDebts.mockResolvedValue(ok([PARTIAL]))
    const user = userEvent.setup()
    await openDialog(user)

    expect(dialog()).toHaveTextContent('Saldo pendiente: $ 2.333,33 ARS')
    expect(amountInput()).toHaveValue('2.333,33')
    expect(within(dialog()).getByTestId('remaining-balance')).toHaveTextContent('Saldo restante: $ 0,00 ARS')
    expect(registerDebtPayment).not.toHaveBeenCalled()
  })

  it('Cancelar y Escape cierran sin registrar y devuelven el foco al botón', async () => {
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(payButton()).toHaveFocus()

    await user.click(payButton())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(registerDebtPayment).not.toHaveBeenCalled()
  })

  it('al confirmar sin editar manda el saldo pendiente con una clave nueva, avisa y recarga las deudas', async () => {
    registerDebtPayment.mockResolvedValue({ ok: true, created: true, payment: { paymentId: 91, status: 'CONFIRMED', debtStatusAfter: 'PAID' } })
    getPendingDebts.mockResolvedValueOnce(ok([OWE])).mockResolvedValueOnce(ok([]))
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))

    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_OPEN_DEBTS_MESSAGE)
    expect(registerDebtPayment).toHaveBeenCalledWith('3', 31, {
      amount: '3333.33',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    })
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_SUCCESS_MESSAGE)
    expect(getPendingDebts).toHaveBeenCalledTimes(2)
  })

  it('permite editar a un monto parcial, muestra el saldo restante, envía el monto elegido y recarga con "Pago parcial"', async () => {
    registerDebtPayment.mockResolvedValue({
      ok: true, created: true, payment: { paymentId: 91, status: 'CONFIRMED', debtStatusAfter: 'PARTIALLY_PAID' },
    })
    getPendingDebts
      .mockResolvedValueOnce(ok([OWE]))
      .mockResolvedValueOnce(ok([PARTIAL]))
    const user = userEvent.setup()
    await openDialog(user)

    await typeAmount(user, '1.000')
    expect(within(dialog()).getByTestId('payment-summary')).toHaveTextContent('Vas a registrar un pago de $ 1.000,00 ARS')
    expect(within(dialog()).getByTestId('remaining-balance')).toHaveTextContent('Saldo restante: $ 2.333,33 ARS')

    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))

    expect(registerDebtPayment).toHaveBeenCalledWith('3', 31, {
      amount: '1000.00',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    })
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_SUCCESS_MESSAGE)
    await waitFor(() => {
      expect(screen.getByTestId('my-debt-row')).toHaveTextContent('Pago parcial · faltan $ 2.333,33')
    })
    expect(getPendingDebts).toHaveBeenCalledTimes(2)
  })

  it('valida 0 < monto ≤ saldo en voseo y NO llama a la API si el monto supera el saldo o es inválido (control negativo)', async () => {
    const user = userEvent.setup()
    await openDialog(user)

    await typeAmount(user, '3.333,34')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('El pago no puede superar el saldo de $ 3.333,33')
    expect(registerDebtPayment).not.toHaveBeenCalled()

    await typeAmount(user, '0')
    await user.tab()
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(AMOUNT_POSITIVE)
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    expect(registerDebtPayment).not.toHaveBeenCalled()

    await typeAmount(user, '')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(AMOUNT_REQUIRED)
    expect(registerDebtPayment).not.toHaveBeenCalled()

    await typeAmount(user, 'abc')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(AMOUNT_FORMAT)
    expect(registerDebtPayment).not.toHaveBeenCalled()

    await typeAmount(user, '500')
    expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si el grupo requiere validación avisa que el pago queda esperando que un administrador lo confirme y muestra el aviso final', async () => {
    getGroup.mockResolvedValue(group('MEMBER', { paymentsRequireValidation: true }))
    registerDebtPayment.mockResolvedValue({ ok: true, created: true, payment: { paymentId: 91, status: 'REPORTED', debtStatusAfter: 'PAYMENT_REPORTED' } })
    const user = userEvent.setup()
    await openDialog(user)

    const notice = within(dialog()).getByTestId('validation-notice')
    expect(notice).toHaveTextContent(VALIDATION_NOTICE)
    expect(notice).toHaveTextContent('el pago queda esperando que un administrador lo confirme')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_REPORTED_MESSAGE))
  })

  it('sin validación no muestra el aviso', async () => {
    const user = userEvent.setup()
    await openDialog(user)
    expect(within(dialog()).queryByTestId('validation-notice')).not.toBeInTheDocument()
  })

  it('un error de red deja abierta la confirmación con el monto elegido y el reintento reutiliza la misma clave', async () => {
    registerDebtPayment
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, created: false, payment: { status: 'CONFIRMED' } })
    const user = userEvent.setup()
    await openDialog(user)
    await typeAmount(user, '1.200,50')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))

    expect(await within(dialog()).findByTestId('payment-error'))
      .toHaveTextContent('No se pudo registrar el pago. Intentá nuevamente')
    expect(amountInput()).toHaveValue('1.200,50')
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))

    await waitFor(() => expect(registerDebtPayment).toHaveBeenCalledTimes(2))
    const calls = registerDebtPayment.mock.calls.map((call) => call[2])
    expect(calls[0]).toEqual({ amount: '1200.50', idempotencyKey: '11111111-1111-4111-8111-111111111111' })
    expect(calls[1]).toEqual(calls[0])
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it.each([
    [400, { fields: { amount: 'El monto del pago excede la deuda pendiente' } }, 'El monto del pago excede la deuda pendiente', true],
    [403, { detail: 'Solo quien debe, quien cobra o un administrador pueden registrar este pago' }, 'Solo quien debe, quien cobra o un administrador pueden registrar este pago', false],
    [404, { detail: 'No existe la deuda solicitada o no sos miembro del grupo' }, 'No existe la deuda solicitada o no sos miembro del grupo', true],
    [409, { detail: ALREADY_REPORTED_MESSAGE }, ALREADY_REPORTED_MESSAGE, true],
    [409, { detail: '' }, ALREADY_REPORTED_MESSAGE, true],
    [422, { detail: '' }, 'Ya se registró un pago con estos datos. Revisá el estado actual', false],
    [503, { detail: '' }, 'El servicio no está disponible en este momento. Intentá más tarde', false],
  ])('un %i muestra el mensaje en voseo, cierra la confirmación y recarga=%s', async (status, extra, message, reloads) => {
    registerDebtPayment.mockResolvedValue({ ok: false, status, fields: {}, detail: '', ...extra })
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))

    expect(await screen.findByTestId('debts-action-error')).toHaveTextContent(message)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(showSnackbar).not.toHaveBeenCalled()
    await waitFor(() => expect(getPendingDebts).toHaveBeenCalledTimes(reloads ? 2 : 1))
  })

  it('después de un rechazo del servidor el nuevo intento usa una clave distinta', async () => {
    registerDebtPayment
      .mockResolvedValueOnce({ ok: false, status: 409, fields: {}, detail: ALREADY_REPORTED_MESSAGE })
      .mockResolvedValueOnce({ ok: true, created: true, payment: { status: 'CONFIRMED' } })
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    await screen.findByTestId('debts-action-error')

    await user.click(await screen.findByRole('button', { name: /Registrar pago: / }))
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    await waitFor(() => expect(registerDebtPayment).toHaveBeenCalledTimes(2))
    const keys = registerDebtPayment.mock.calls.map((call) => call[2].idempotencyKey)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('un 401 cierra la sesión', async () => {
    registerDebtPayment.mockResolvedValue({ ok: false, status: 401 })
    const user = userEvent.setup()
    await openDialog(user)
    await user.click(within(dialog()).getByRole('button', { name: 'Sí, registrar pago' }))
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})

describe('GroupDebtsView: pagos por validar (022 T075)', () => {
  const PAYMENT = {
    paymentId: 91, debtId: 31, expenseId: 12, payerUserId: 15, payerName: 'Juan Pérez',
    receiverName: 'Ana López', amount: 3333.33, currency: 'ARS', registeredAt: '2026-11-05T12:00:00Z', daysPending: 2,
  }

  async function openValidation(user) {
    getGroup.mockResolvedValue(group('ADMIN'))
    getPaymentsPendingValidation.mockResolvedValue({ ok: true, payments: [PAYMENT] })
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Pagos por validar' }))
    return screen.findByTestId('pending-payment-row')
  }

  it('lista los pagos informados con quién paga, a quién, el monto, los días y el enlace al gasto', async () => {
    const row = await openValidation(userEvent.setup())

    expect(row).toHaveTextContent('Juan Pérez informó un pago a Ana López')
    expect(row).toHaveTextContent('$ 3.333,33 ARS')
    expect(row).toHaveTextContent('Informado hace 2 días')
    expect(within(row).getByRole('link', { name: 'Ver gasto' })).toHaveAttribute('href', '/groups/3/expenses/12')
  })

  it('confirmar avisa, recarga la lista y las otras pestañas', async () => {
    confirmPayment.mockResolvedValue({ ok: true, payment: { status: 'CONFIRMED' } })
    getPaymentsPendingValidation
      .mockResolvedValueOnce({ ok: true, payments: [PAYMENT] })
      .mockResolvedValueOnce({ ok: true, payments: [] })
    const user = userEvent.setup()
    getGroup.mockResolvedValue(group('ADMIN'))
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Pagos por validar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar pago de Juan Pérez a Ana López' }))

    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_PENDING_PAYMENTS_MESSAGE)
    expect(confirmPayment).toHaveBeenCalledWith('3', 91)
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_CONFIRMED_MESSAGE)

    getPendingDebts.mockClear()
    await user.click(tab('Mis deudas pendientes'))
    await waitFor(() => expect(getPendingDebts).toHaveBeenCalled())
  })

  it('rechazar avisa y recarga la lista', async () => {
    rejectPayment.mockResolvedValue({ ok: true, payment: { status: 'REJECTED' } })
    getPaymentsPendingValidation
      .mockResolvedValueOnce({ ok: true, payments: [PAYMENT] })
      .mockResolvedValueOnce({ ok: true, payments: [] })
    const user = userEvent.setup()
    getGroup.mockResolvedValue(group('ADMIN'))
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Pagos por validar' }))
    await user.click(await screen.findByRole('button', { name: 'Rechazar pago de Juan Pérez a Ana López' }))

    await screen.findByTestId('debts-empty')
    expect(rejectPayment).toHaveBeenCalledWith('3', 91)
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_REJECTED_MESSAGE)
    expect(confirmPayment).not.toHaveBeenCalled()
  })

  it('un 409 por pago ya decidido muestra el mensaje del servidor y recarga la lista', async () => {
    confirmPayment.mockResolvedValue({
      ok: false, status: 409, fields: {}, detail: 'Este pago no está pendiente de validación',
    })
    getPaymentsPendingValidation
      .mockResolvedValueOnce({ ok: true, payments: [PAYMENT] })
      .mockResolvedValueOnce({ ok: true, payments: [] })
    const user = userEvent.setup()
    getGroup.mockResolvedValue(group('ADMIN'))
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Pagos por validar' }))
    await user.click(await screen.findByRole('button', { name: /Confirmar pago/ }))

    expect(await screen.findByTestId('decision-error')).toHaveTextContent('Este pago no está pendiente de validación')
    await waitFor(() => expect(getPaymentsPendingValidation).toHaveBeenCalledTimes(2))
    expect(showSnackbar).not.toHaveBeenCalled()
  })

  it('un 403 y un error de red muestran su mensaje y dejan los botones disponibles', async () => {
    const user = userEvent.setup()
    await openValidation(user)

    rejectPayment.mockResolvedValueOnce({ ok: false, status: 403, fields: {}, detail: 'Solo los administradores pueden rechazar pagos' })
    await user.click(screen.getByRole('button', { name: /Rechazar pago/ }))
    expect(await screen.findByTestId('decision-error')).toHaveTextContent('Solo los administradores pueden rechazar pagos')

    confirmPayment.mockResolvedValueOnce({ ok: false, network: true })
    await user.click(screen.getByRole('button', { name: /Confirmar pago/ }))
    await waitFor(() =>
      expect(screen.getByTestId('decision-error')).toHaveTextContent(PAYMENT_DECISION_NETWORK_ERROR_MESSAGE))
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeEnabled()
  })

  it('sin pagos por validar y con error muestra los mensajes', async () => {
    getGroup.mockResolvedValue(group('ADMIN'))
    const user = userEvent.setup()
    renderView()
    await user.click(await screen.findByRole('tab', { name: 'Pagos por validar' }))
    expect(await screen.findByTestId('debts-empty')).toHaveTextContent(NO_PENDING_PAYMENTS_MESSAGE)

    getPaymentsPendingValidation.mockResolvedValueOnce({ ok: false, status: 500 })
    await user.click(tab('Saldos'))
    await user.click(tab('Pagos por validar'))
    expect(await screen.findByTestId('debts-error')).toBeInTheDocument()
  })
})

describe('GroupDebtsView: deep link de deudas (035 FR-017)', () => {
  it('resalta y hace scroll a la deuda indicada por ?debt=', async () => {
    const scrollIntoView = vi.fn()
    // jsdom does not implement scrollIntoView: provide it for this scenario.
    Element.prototype.scrollIntoView = scrollIntoView
    getPendingDebts.mockResolvedValue(ok([OWE, OWED_USD]))

    renderView('/groups/3/debts?debt=32')

    const rows = await screen.findAllByTestId('my-debt-row')
    expect(rows).toHaveLength(2)
    await waitFor(() => expect(rows[1]).toHaveAttribute('data-highlighted', 'true'))
    expect(scrollIntoView).toHaveBeenCalled()
    expect(within(rows[1]).getByText(/Juan Pérez te debe/)).toBeInTheDocument()
  })
})
