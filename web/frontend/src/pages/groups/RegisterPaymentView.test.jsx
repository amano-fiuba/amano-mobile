import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupExpensesClient', async (importOriginal) => ({
  ...await importOriginal(),
  getGroupExpense: vi.fn(),
}))

vi.mock('../../api/paymentsClient', async (importOriginal) => ({
  ...await importOriginal(),
  registerPayment: vi.fn(),
}))

const setUser = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 15 }, setUser }),
}))

const showSnackbar = vi.fn()
vi.mock('../../components/Snackbar', () => ({
  useSnackbar: () => showSnackbar,
}))

vi.mock('../../hooks/useCurrentDate', () => ({
  default: () => ({ today: '05/11/2026' }),
  deviceTimeZone: () => 'America/Argentina/Buenos_Aires',
}))

import { GROUP_EXPENSE_LOAD_ERROR_MESSAGE, getGroupExpense } from '../../api/groupExpensesClient'
import { PAYMENT_NETWORK_ERROR_MESSAGE, registerPayment } from '../../api/paymentsClient'
import { AMOUNT_REQUIRED, DATE_FUTURE } from '../../validation/expenseValidation'
import { PAYMENT_BEFORE_EXPENSE } from './paymentValidation'
import RegisterPaymentView, {
  CANNOT_PAY_MESSAGE,
  DEBT_ALREADY_PAID_MESSAGE,
  DEBT_AWAITING_VALIDATION_MESSAGE,
  DEBT_NOT_FOUND_MESSAGE,
  PAYMENT_REPORTED_MESSAGE,
  PAYMENT_REUSED_KEY_MESSAGE,
  PAYMENT_SUCCESS_MESSAGE,
} from './RegisterPaymentView'

// 018 T045 (US3): "Registrar pago" screen (plan.md §Componentes).

const DEBT = {
  id: 31,
  debtor: { type: 'REGISTERED', userId: 15, simulatedProfileId: null, name: 'Juan Pérez' },
  creditor: { userId: 7, name: 'Ana López' },
  amount: '3333.33',
  paidAmount: '1000.00',
  outstanding: '2333.33',
  currency: 'ARS',
  status: 'PARTIALLY_PAID',
  canRegisterPayment: true,
}

function expenseWith(debt = DEBT) {
  return { ok: true, expense: { id: 12, groupId: 3, date: '2026-11-01', debts: [debt] } }
}

function renderView(path = '/groups/3/expenses/12/debts/31/payment') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/groups/:id/expenses/:expenseId/debts/:debtId/payment" element={<RegisterPaymentView />} />
        <Route path="/groups/:id/expenses/:expenseId" element={<p>Detalle del gasto</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function readyForm() {
  renderView()
  return screen.findByLabelText('Monto')
}

async function setField(user, label, value) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (value) await user.type(input, value)
}

beforeEach(() => {
  getGroupExpense.mockReset()
  registerPayment.mockReset()
  setUser.mockReset()
  showSnackbar.mockReset()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('key-1')
  getGroupExpense.mockResolvedValue(expenseWith())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RegisterPaymentView (018)', () => {
  it('carga la deuda con el monto en el saldo, la fecha de hoy y la vista previa', async () => {
    const user = userEvent.setup()
    renderView()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')

    const amount = await screen.findByLabelText('Monto')
    expect(getGroupExpense).toHaveBeenCalledWith('3', '12')
    expect(amount).toHaveValue('2.333,33')
    expect(screen.getByLabelText('Fecha')).toHaveValue('05/11/2026')
    expect(screen.getByRole('heading', { name: 'Juan Pérez le paga a Ana López' })).toBeInTheDocument()
    expect(within(screen.getByTestId('payment-outcome')).getByTestId('debt-status')).toHaveTextContent('Pagada')

    await setField(user, 'Monto', '333,33')
    expect(within(screen.getByTestId('payment-outcome')).getByTestId('debt-status'))
      .toHaveTextContent('Pago parcial · faltan $ 2.000,00')
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/groups/3/expenses/12')
  })

  it('valida en el cliente sin llamar al backend', async () => {
    const user = userEvent.setup()
    await readyForm()

    await setField(user, 'Monto', '2.333,34')
    await setField(user, 'Fecha', '06/11/2026')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('El pago no puede superar el saldo de $ 2.333,33')).toBeInTheDocument()
    expect(screen.getByText(DATE_FUTURE)).toBeInTheDocument()

    await setField(user, 'Monto', '')
    await setField(user, 'Fecha', '31/10/2026')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText(AMOUNT_REQUIRED)).toBeInTheDocument()
    expect(screen.getByText(PAYMENT_BEFORE_EXPENSE)).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it('permite pagar antes de la fecha de una ocurrencia futura (028)', async () => {
    const user = userEvent.setup()
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: { id: 12, groupId: 3, date: '2026-11-16', debts: [DEBT] },
    })
    registerPayment.mockResolvedValue({ ok: true, payment: { id: 54, status: 'CONFIRMED' }, created: true })
    await readyForm()

    await setField(user, 'Fecha', '31/10/2026')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    await waitFor(() => expect(registerPayment).toHaveBeenCalled())
    expect(screen.queryByText(PAYMENT_BEFORE_EXPENSE)).not.toBeInTheDocument()
  })

  it('201 con pago confirmado muestra "Pago registrado" y vuelve al detalle del gasto', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({ ok: true, payment: { id: 54, status: 'CONFIRMED' }, created: true })
    await readyForm()

    await setField(user, 'Monto', '1.000')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('Detalle del gasto')).toBeInTheDocument()
    expect(registerPayment).toHaveBeenCalledWith({
      debtId: 31,
      amount: '1000.00',
      date: '2026-11-05',
      deviceTimeZone: 'America/Argentina/Buenos_Aires',
    }, 'key-1')
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_SUCCESS_MESSAGE)
  })

  it('201 con pago informado (status REPORTED) avisa que queda esperando validación (022 T085)', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({
      ok: true,
      payment: { id: 54, status: 'REPORTED', debt: { status: 'PAYMENT_REPORTED' } },
      created: true,
    })
    await readyForm()

    await setField(user, 'Monto', '1.000')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('Detalle del gasto')).toBeInTheDocument()
    expect(showSnackbar).toHaveBeenCalledWith(PAYMENT_REPORTED_MESSAGE)
    expect(showSnackbar).not.toHaveBeenCalledWith(PAYMENT_SUCCESS_MESSAGE)
  })

  it('un error de red conserva la clave para el reintento', async () => {
    const user = userEvent.setup()
    registerPayment
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, payment: { id: 54 }, created: false })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-form-error')).toHaveTextContent(PAYMENT_NETWORK_ERROR_MESSAGE)

    crypto.randomUUID.mockReturnValue('key-2')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('Detalle del gasto')).toBeInTheDocument()
    expect(registerPayment.mock.calls.map((call) => call[1])).toEqual(['key-1', 'key-1'])
  })

  it('400 muestra cada mensaje junto a su campo y renueva la clave', async () => {
    const user = userEvent.setup()
    registerPayment
      .mockResolvedValueOnce({
        ok: false, status: 400, detail: '', fields: { amount: 'El pago no puede superar el saldo de $ 10,00' },
      })
      .mockResolvedValueOnce({ ok: false, status: 400, detail: '', fields: { debtId: 'Indicá la deuda a pagar' } })
      .mockResolvedValueOnce({ ok: false, status: 400, detail: '', fields: {} })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByText('El pago no puede superar el saldo de $ 10,00')).toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toHaveValue('2.333,33')

    crypto.randomUUID.mockReturnValue('key-2')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-form-error')).toHaveTextContent('Indicá la deuda a pagar')

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(screen.getByTestId('register-payment-form-error'))
      .toHaveTextContent(PAYMENT_NETWORK_ERROR_MESSAGE))
    expect(registerPayment.mock.calls.map((call) => call[1])).toEqual(['key-1', 'key-2', 'key-2'])
  })

  it('403 muestra el detalle del servidor', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({
      ok: false, status: 403, detail: 'Solo quien debe, quien cobra o un administrador pueden registrar este pago', fields: {},
    })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-form-error'))
      .toHaveTextContent('Solo quien debe, quien cobra o un administrador pueden registrar este pago')
  })

  it('409 avisa que la deuda ya está pagada (o esperando validación) y ofrece volver', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({ ok: false, status: 409, detail: 'La deuda ya está pagada', code: 'DEBT_ALREADY_PAID' })
    const { unmount } = await readyForm().then(() => ({ unmount: renderView().unmount }))
    unmount()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    const blocked = await screen.findByTestId('register-payment-blocked')
    expect(blocked).toHaveTextContent(DEBT_ALREADY_PAID_MESSAGE)
    expect(within(blocked).getByRole('link', { name: 'Volver al gasto' })).toHaveAttribute('href', '/groups/3/expenses/12')
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
  })

  it('409 con pago esperando validación muestra el texto en voseo del servidor y una deuda ya informada bloquea el formulario', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({
      ok: false,
      status: 409,
      detail: DEBT_AWAITING_VALIDATION_MESSAGE,
      code: 'DEBT_ALREADY_HAS_PAYMENT',
    })
    const { unmount } = renderView()
    await screen.findByLabelText('Monto')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-blocked')).toHaveTextContent(DEBT_AWAITING_VALIDATION_MESSAGE)
    unmount()

    registerPayment.mockResolvedValue({ ok: false, status: 409, detail: '' })
    const second = renderView()
    await screen.findByLabelText('Monto')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-blocked')).toHaveTextContent(DEBT_ALREADY_PAID_MESSAGE)
    second.unmount()

    getGroupExpense.mockResolvedValue(expenseWith({ ...DEBT, status: 'PAYMENT_REPORTED', canRegisterPayment: false }))
    renderView()
    expect(await screen.findByTestId('register-payment-blocked')).toHaveTextContent(DEBT_AWAITING_VALIDATION_MESSAGE)
  })

  it('404 al enviar muestra el mensaje neutral', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({ ok: false, status: 404, detail: '', fields: {} })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-error')).toHaveTextContent(DEBT_NOT_FOUND_MESSAGE)
  })

  it('422 avisa que la operación ya fue registrada', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({ ok: false, status: 422, detail: '', code: 'IDEMPOTENCY_KEY_REUSED' })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    expect(await screen.findByTestId('register-payment-form-error')).toHaveTextContent(PAYMENT_REUSED_KEY_MESSAGE)
  })

  it('401 al enviar cierra la sesión', async () => {
    const user = userEvent.setup()
    registerPayment.mockResolvedValue({ ok: false, status: 401 })
    await readyForm()

    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('una deuda pagada o sin permiso no muestra el formulario', async () => {
    getGroupExpense.mockResolvedValue(expenseWith({ ...DEBT, status: 'PAID', outstanding: '0.00', canRegisterPayment: false }))
    const { unmount } = renderView()
    expect(await screen.findByTestId('register-payment-blocked')).toHaveTextContent(DEBT_ALREADY_PAID_MESSAGE)
    unmount()

    getGroupExpense.mockResolvedValue(expenseWith({ ...DEBT, canRegisterPayment: false }))
    renderView()
    expect(await screen.findByTestId('register-payment-blocked')).toHaveTextContent(CANNOT_PAY_MESSAGE)
    expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
  })

  it('una deuda que no está en el gasto o un gasto inexistente dan el 404 neutral', async () => {
    const { unmount } = renderView('/groups/3/expenses/12/debts/99/payment')
    const alert = await screen.findByTestId('register-payment-error')
    expect(alert).toHaveTextContent(DEBT_NOT_FOUND_MESSAGE)
    expect(within(alert).getByRole('link', { name: 'Volver al gasto' })).toBeInTheDocument()
    unmount()

    getGroupExpense.mockResolvedValue({ ok: false, status: 404 })
    renderView()
    expect(await screen.findByTestId('register-payment-error')).toHaveTextContent(DEBT_NOT_FOUND_MESSAGE)

    getGroupExpense.mockResolvedValue({ ok: true, expense: { id: 12 } })
    renderView()
    expect((await screen.findAllByTestId('register-payment-error')).at(-1)).toHaveTextContent(DEBT_NOT_FOUND_MESSAGE)
  })

  it('un error de red al cargar permite reintentar', async () => {
    const user = userEvent.setup()
    getGroupExpense
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce(expenseWith())
    renderView()

    const alert = await screen.findByTestId('register-payment-error')
    expect(alert).toHaveTextContent(GROUP_EXPENSE_LOAD_ERROR_MESSAGE)
    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Monto')).toBeInTheDocument()
  })

  it('401 al cargar cierra la sesión', async () => {
    getGroupExpense.mockResolvedValue({ ok: false, status: 401 })
    renderView()
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})
