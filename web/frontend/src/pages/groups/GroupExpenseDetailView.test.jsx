import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupExpensesClient', async (importOriginal) => ({
  ...await importOriginal(),
  getGroupExpense: vi.fn(),
  deleteGroupExpense: vi.fn(),
}))

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  getGroup: vi.fn(),
}))

const setUser = vi.fn()
let authUserId = 7
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ setUser, user: { id: authUserId } }),
}))

const showSnackbar = vi.fn()
vi.mock('../../components/Snackbar', () => ({
  useSnackbar: () => showSnackbar,
}))

import { getGroup } from '../../api/groupsClient'
import {
  GROUP_EXPENSE_DELETE_ERROR_MESSAGE,
  GROUP_EXPENSE_LOAD_ERROR_MESSAGE,
  deleteGroupExpense,
  getGroupExpense,
} from '../../api/groupExpensesClient'
import GroupExpenseDetailView, {
  DELETE_CONFIRM_MESSAGE,
  DELETE_SUCCESS_MESSAGE,
  EXPENSE_NOT_FOUND_MESSAGE,
} from './GroupExpenseDetailView'

// 017 T037 (US3): detail of a group expense with its debts and their states.

const ANA = { userId: 7, name: 'Ana López' }

const EXPENSE = {
  id: 12,
  groupId: 3,
  amount: '10000.00',
  currency: 'ARS',
  date: '2026-11-05',
  description: 'Súper',
  payer: ANA,
  createdBy: ANA,
  createdAt: '2026-11-05T15:20:00Z',
  shares: [
    { position: 0, type: 'REGISTERED', userId: 7, simulatedProfileId: null, name: 'Ana López', amount: '3333.34', isPayer: true },
    { position: 1, type: 'REGISTERED', userId: 15, simulatedProfileId: null, name: 'Juan Pérez', amount: '3333.33', isPayer: false },
    { position: 2, type: 'SIMULATED', userId: null, simulatedProfileId: null, name: 'Abuela', amount: '3333.33', isPayer: false },
  ],
  debts: [
    {
      id: 31,
      debtor: { type: 'REGISTERED', userId: 15, simulatedProfileId: null, name: 'Juan Pérez' },
      creditor: ANA,
      amount: '3333.33',
      paidAmount: '1000.00',
      outstanding: '2333.33',
      currency: 'ARS',
      status: 'PARTIALLY_PAID',
    },
    {
      id: 32,
      debtor: { type: 'SIMULATED', userId: null, simulatedProfileId: null, name: 'Abuela' },
      creditor: ANA,
      amount: '3333.33',
      paidAmount: '0.00',
      outstanding: '3333.33',
      currency: 'ARS',
      status: 'PENDING',
    },
  ],
}

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/groups/3/expenses/12']}>
      <Routes>
        <Route path="/groups/:id/expenses/:expenseId" element={<GroupExpenseDetailView />} />
        <Route path="/groups/:id" element={<p>Pantalla del grupo</p>} />
        <Route path="/groups/:id/expenses/:expenseId/edit" element={<p>Pantalla de edición</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getGroupExpense.mockReset()
  deleteGroupExpense.mockReset()
  getGroup.mockReset()
  getGroup.mockResolvedValue({ ok: true, group: { id: 3, currentUserRole: 'MEMBER' } })
  setUser.mockReset()
  showSnackbar.mockReset()
  authUserId = 7
})

describe('GroupExpenseDetailView (017)', () => {
  it('muestra el total, el pagador, las partes en orden y cada deuda con su estado', async () => {
    getGroupExpense.mockResolvedValue({ ok: true, expense: EXPENSE })
    renderView()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')

    const header = await screen.findByTestId('group-expense-detail')
    expect(header).toHaveTextContent('Súper')
    expect(header).toHaveTextContent('ARS $ 10.000,00')
    expect(header).toHaveTextContent('05/11/2026 · Pagó Ana López')
    expect(getGroupExpense).toHaveBeenCalledWith('3', '12')

    const shares = screen.getAllByTestId('share-row')
    expect(shares.map((row) => row.textContent)).toEqual([
      'Ana López (pagó)$ 3.333,34',
      'Juan Pérez$ 3.333,33',
      'Abuela$ 3.333,33',
    ])

    const debts = screen.getAllByTestId('debt-row')
    expect(debts[0]).toHaveTextContent('Juan Pérez le debe a Ana López')
    expect(within(debts[0]).getByTestId('debt-status')).toHaveTextContent('Pago parcial · faltan $ 2.333,33')
    expect(debts[1]).toHaveTextContent('Abuela le debe a Ana López')
    expect(within(debts[1]).getByTestId('debt-status')).toHaveTextContent('Pendiente')
    expect(screen.getByRole('link', { name: 'Volver al grupo' })).toHaveAttribute('href', '/groups/3')
  })

  it('cada deuda que la persona puede pagar lleva a "Registrar pago" (018 FR-017)', async () => {
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: {
        ...EXPENSE,
        debts: [{ ...EXPENSE.debts[0], canRegisterPayment: true }, { ...EXPENSE.debts[1], canRegisterPayment: false }],
      },
    })
    renderView()
    const debts = await screen.findAllByTestId('debt-row')
    expect(within(debts[0]).getByRole('link', { name: 'Registrar pago' }))
      .toHaveAttribute('href', '/groups/3/expenses/12/debts/31/payment')
    expect(within(debts[1]).queryByRole('link', { name: 'Registrar pago' })).not.toBeInTheDocument()
  })

  it('un gasto sin descripción y una deuda pagada', async () => {
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: {
        ...EXPENSE,
        description: undefined,
        payer: null,
        shares: undefined,
        debts: [{ ...EXPENSE.debts[0], status: 'PAID', paidAmount: '3333.33', outstanding: '0.00' }],
      },
    })
    renderView()
    expect(await screen.findByRole('heading', { name: 'Gasto sin descripción' })).toBeInTheDocument()
    expect(screen.getByTestId('group-expense-detail')).toHaveTextContent('Pagó alguien')
    expect(screen.queryByTestId('share-row')).not.toBeInTheDocument()
    expect(screen.getByTestId('debt-status')).toHaveTextContent('Pagada')
  })

  it('404 muestra el mensaje neutral sin reintento', async () => {
    getGroupExpense.mockResolvedValue({ ok: false, status: 404 })
    renderView()
    const alert = await screen.findByTestId('group-expense-detail-error')
    expect(alert).toHaveTextContent(EXPENSE_NOT_FOUND_MESSAGE)
    expect(within(alert).queryByRole('button')).not.toBeInTheDocument()
  })

  it('un error de red permite reintentar', async () => {
    const user = userEvent.setup()
    getGroupExpense
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, expense: EXPENSE })
    renderView()
    const alert = await screen.findByTestId('group-expense-detail-error')
    expect(alert).toHaveTextContent(GROUP_EXPENSE_LOAD_ERROR_MESSAGE)

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByTestId('group-expense-detail')).toBeInTheDocument()
  })

  it('401 cierra la sesión', async () => {
    getGroupExpense.mockResolvedValue({ ok: false, status: 401 })
    renderView()
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})

// 022 T077: editar y borrar un gasto personal desde el detalle.
describe('GroupExpenseDetailView: gasto personal (022 T077)', () => {
  const JUAN = { userId: 15, name: 'Juan Pérez' }
  const PERSONAL = {
    ...EXPENSE,
    shares: [EXPENSE.shares[0]],
    debts: [],
  }
  const editLink = () => screen.queryByRole('link', { name: 'Editar gasto' })
  const deleteButton = () => screen.queryByRole('button', { name: 'Eliminar gasto' })

  async function renderPersonal(expense = PERSONAL) {
    getGroupExpense.mockResolvedValue({ ok: true, expense })
    renderView()
    await screen.findByTestId('group-expense-detail')
    await waitFor(() => expect(getGroup).toHaveBeenCalledWith('3'))
  }

  it('quien lo registró ve Editar y Eliminar; Editar lleva al formulario de edición', async () => {
    await renderPersonal()

    expect(await screen.findByRole('link', { name: 'Editar gasto' })).toHaveAttribute('href', '/groups/3/expenses/12/edit')
    expect(deleteButton()).toBeInTheDocument()
  })

  it('el pagador (aunque no lo haya registrado) y un administrador también los ven', async () => {
    authUserId = 15
    await renderPersonal({ ...PERSONAL, payer: JUAN })
    expect(await screen.findByRole('link', { name: 'Editar gasto' })).toBeInTheDocument()
  })

  it('un administrador los ve en un gasto personal ajeno', async () => {
    authUserId = 99
    getGroup.mockResolvedValue({ ok: true, group: { id: 3, currentUserRole: 'ADMIN' } })
    await renderPersonal({ ...PERSONAL, payer: JUAN, createdBy: JUAN })
    expect(await screen.findByRole('link', { name: 'Editar gasto' })).toBeInTheDocument()
    expect(deleteButton()).toBeInTheDocument()
  })

  it('un miembro que no lo registró ni pagó no los ve', async () => {
    authUserId = 99
    await renderPersonal({ ...PERSONAL, payer: JUAN, createdBy: JUAN })
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(editLink()).not.toBeInTheDocument()
    expect(deleteButton()).not.toBeInTheDocument()
  })

  it('un gasto compartido (con participantes o deudas) no se ofrece para editar ni borrar, ni a un admin', async () => {
    getGroup.mockResolvedValue({ ok: true, group: { id: 3, currentUserRole: 'ADMIN' } })
    await renderPersonal(EXPENSE)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(editLink()).not.toBeInTheDocument()
    expect(deleteButton()).not.toBeInTheDocument()
  })

  it('si no se puede leer el grupo, quien registró el gasto igual lo ve (el servidor decide)', async () => {
    getGroup.mockResolvedValue({ ok: false, network: true })
    await renderPersonal()
    expect(await screen.findByRole('link', { name: 'Editar gasto' })).toBeInTheDocument()
  })

  it('pide confirmación antes de borrar y Cancelar no borra', async () => {
    const user = userEvent.setup()
    await renderPersonal()
    await user.click(await screen.findByRole('button', { name: 'Eliminar gasto' }))

    const dialog = screen.getByRole('dialog', { name: 'Eliminar gasto' })
    expect(dialog).toHaveTextContent(DELETE_CONFIRM_MESSAGE)
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteGroupExpense).not.toHaveBeenCalled()
  })

  it('al confirmar borra, avisa y vuelve al grupo', async () => {
    deleteGroupExpense.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    await renderPersonal()
    await user.click(await screen.findByRole('button', { name: 'Eliminar gasto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, eliminar' }))

    expect(await screen.findByText('Pantalla del grupo')).toBeInTheDocument()
    expect(deleteGroupExpense).toHaveBeenCalledWith('3', '12')
    expect(showSnackbar).toHaveBeenCalledWith(DELETE_SUCCESS_MESSAGE)
  })

  it('409 con deudas asociadas y 403 muestran el mensaje del servidor y cierran la confirmación', async () => {
    const user = userEvent.setup()
    await renderPersonal()

    deleteGroupExpense.mockResolvedValueOnce({
      ok: false,
      status: 409,
      detail: 'No se puede eliminar un gasto con deudas asociadas',
    })
    await user.click(await screen.findByRole('button', { name: 'Eliminar gasto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByTestId('group-expense-delete-error'))
      .toHaveTextContent('No se puede eliminar un gasto con deudas asociadas')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    deleteGroupExpense.mockResolvedValueOnce({ ok: false, status: 403, detail: 'No podés eliminar este gasto' })
    await user.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() =>
      expect(screen.getByTestId('group-expense-delete-error')).toHaveTextContent('No podés eliminar este gasto'))
    expect(showSnackbar).not.toHaveBeenCalled()
  })

  it('un error de red al borrar muestra el mensaje y se puede reintentar; un 401 cierra la sesión', async () => {
    const user = userEvent.setup()
    await renderPersonal()

    deleteGroupExpense.mockResolvedValueOnce({ ok: false, network: true })
    await user.click(await screen.findByRole('button', { name: 'Eliminar gasto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, eliminar' }))
    expect(await screen.findByTestId('group-expense-delete-error'))
      .toHaveTextContent(GROUP_EXPENSE_DELETE_ERROR_MESSAGE)

    deleteGroupExpense.mockResolvedValueOnce({ ok: false, status: 401 })
    await user.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sí, eliminar' }))
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})

describe('GroupExpenseDetailView: origen recurrente (029)', () => {
  it('muestra que el gasto dio origen a una serie recurrente', async () => {
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: { ...EXPENSE, recurrence: { seriesId: 12, origin: 'SERIE' } },
    })
    renderView()

    const origin = await screen.findByTestId('recurrence-origin')
    expect(origin).toHaveTextContent('Este gasto dio origen a una serie recurrente')
  })

  it('muestra que un gasto fue generado automáticamente desde una serie', async () => {
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: { ...EXPENSE, recurrence: { seriesId: 99, origin: 'SISTEMA' } },
    })
    renderView()

    const origin = await screen.findByTestId('recurrence-origin')
    expect(origin).toHaveTextContent('Gasto generado de la serie recurrente')
    expect(origin).toHaveTextContent('Creado automáticamente por el sistema')
    expect(screen.getByRole('link', { name: 'serie recurrente' })).toHaveAttribute(
      'href',
      '/groups/3/expenses/99',
    )
  })

  it('muestra que un gasto fue generado al reanudar una serie', async () => {
    getGroupExpense.mockResolvedValue({
      ok: true,
      expense: {
        ...EXPENSE,
        recurrence: { seriesId: 99, origin: 'MIEMBRO' },
        createdBy: { userId: 7, name: 'Ana López' },
      },
    })
    renderView()

    const origin = await screen.findByTestId('recurrence-origin')
    expect(origin).toHaveTextContent('Creado al reanudar la serie por Ana López')
  })
})
