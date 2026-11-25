import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'

// "Gastos recurrentes" (feature 009, US3/US4). The API client is mocked so every
// backend outcome is driven explicitly.
vi.mock('../api/expenseClient', () => ({
  RECURRING_LOAD_ERROR_MESSAGE:
    'No se pudieron cargar tus gastos recurrentes. Intentá nuevamente',
  RECURRING_UPDATE_ERROR_MESSAGE:
    'No se pudo actualizar el gasto recurrente. Intentá nuevamente',
  listRecurringExpenses: vi.fn(),
  updateRecurringExpenseStatus: vi.fn(),
}))

import { listRecurringExpenses, updateRecurringExpenseStatus } from '../api/expenseClient'
import RecurringExpensesPage, {
  EMPTY_MESSAGE,
  FINISH_CONFIRMATION_MESSAGE,
  FINISHED_MESSAGE,
  PAUSED_MESSAGE,
  RESUMED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
} from './RecurringExpensesPage'

const ACTIVE = {
  id: 81,
  amount: '250000.00',
  currency: 'ARS',
  date: '2026-10-01',
  category: 'HOUSING',
  type: 'RECURRING',
  paymentMethod: 'TRANSFER',
  description: 'Alquiler',
  frequency: 'MONTHLY',
  status: 'ACTIVE',
  nextOccurrenceDate: '2026-11-01',
}
const PAUSED = {
  ...ACTIVE,
  id: 64,
  amount: '9999.00',
  category: 'LEISURE',
  description: undefined,
  frequency: 'WEEKLY',
  status: 'PAUSED',
  nextOccurrenceDate: '2026-10-31',
}
const FINISHED = { ...ACTIVE, id: 12, status: 'FINISHED', nextOccurrenceDate: undefined }

function renderPage() {
  return render(
    <MemoryRouter>
      <RecurringExpensesPage />
    </MemoryRouter>,
  )
}

function item(id) {
  return within(screen.getByTestId(`recurring-${id}`))
}

beforeEach(() => {
  listRecurringExpenses.mockReset()
  updateRecurringExpenseStatus.mockReset()
})

describe('RecurringExpensesPage (009)', () => {
  it('lista las series con monto, frecuencia, estado y próxima fecha (FR-012)', async () => {
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE, PAUSED, FINISHED] })
    renderPage()

    expect(screen.getByText('Cargando tus gastos recurrentes…')).toBeInTheDocument()
    await screen.findByTestId('recurring-81')

    expect(item(81).getByText('Alquiler')).toBeInTheDocument()
    expect(item(81).getByText('Activo')).toBeInTheDocument()
    expect(item(81).getByText(/250\.000,00 ARS · Mensual · Vivienda/)).toBeInTheDocument()
    expect(item(81).getByText(/Próxima fecha: 01\/11\/2026/)).toBeInTheDocument()
    // Without description the category names the series.
    expect(item(64).getByText('Ocio', { selector: 'strong' })).toBeInTheDocument()
    expect(item(64).getByText('Pausado')).toBeInTheDocument()
    expect(item(12).getByText('Finalizado')).toBeInTheDocument()
    expect(item(12).queryByText(/Próxima fecha/)).not.toBeInTheDocument()
  })

  it('ofrece solo las acciones válidas para cada estado (FR-012)', async () => {
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE, PAUSED, FINISHED] })
    renderPage()
    await screen.findByTestId('recurring-81')

    expect(item(81).getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(item(81).getByRole('button', { name: 'Finalizar' })).toBeInTheDocument()
    expect(item(81).queryByRole('button', { name: 'Reanudar' })).not.toBeInTheDocument()
    expect(item(64).getByRole('button', { name: 'Reanudar' })).toBeInTheDocument()
    expect(item(64).getByRole('button', { name: 'Finalizar' })).toBeInTheDocument()
    expect(item(12).queryAllByRole('button')).toHaveLength(0)
  })

  it('pausa con estado de carga, actualiza la serie y notifica (US3-1, FR-013)', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE] })
    let resolve
    updateRecurringExpenseStatus.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    renderPage()
    await screen.findByTestId('recurring-81')

    await user.click(item(81).getByRole('button', { name: 'Pausar' }))

    expect(updateRecurringExpenseStatus).toHaveBeenCalledWith(81, 'PAUSED')
    expect(item(81).getByRole('button', { name: 'Pausando…' })).toBeDisabled()
    expect(item(81).getByRole('button', { name: 'Finalizar' })).toBeDisabled()

    resolve({ ok: true, expense: { ...ACTIVE, status: 'PAUSED' } })

    expect(await screen.findByTestId('snackbar')).toHaveTextContent(PAUSED_MESSAGE)
    expect(item(81).getByText('Pausado')).toBeInTheDocument()
    expect(item(81).getByRole('button', { name: 'Reanudar' })).toBeEnabled()
  })

  it('reanuda una serie pausada y muestra la nueva próxima fecha (US3-3)', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [PAUSED] })
    updateRecurringExpenseStatus.mockResolvedValue({
      ok: true,
      expense: { ...PAUSED, status: 'ACTIVE', nextOccurrenceDate: '2026-11-07' },
    })
    renderPage()
    await screen.findByTestId('recurring-64')

    await user.click(item(64).getByRole('button', { name: 'Reanudar' }))

    expect(updateRecurringExpenseStatus).toHaveBeenCalledWith(64, 'ACTIVE')
    expect(await screen.findByTestId('snackbar')).toHaveTextContent(RESUMED_MESSAGE)
    expect(item(64).getByText('Activo')).toBeInTheDocument()
    expect(item(64).getByText(/Próxima fecha: 07\/11\/2026/)).toBeInTheDocument()
  })

  it('finalizar pide confirmación y cancelar no envía nada (US4-1)', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE] })
    renderPage()
    await screen.findByTestId('recurring-81')

    await user.click(item(81).getByRole('button', { name: 'Finalizar' }))

    const confirm = screen.getByRole('group', { name: 'Confirmar finalización' })
    expect(confirm).toHaveTextContent(FINISH_CONFIRMATION_MESSAGE)
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))

    expect(updateRecurringExpenseStatus).not.toHaveBeenCalled()
    expect(item(81).getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
  })

  it('al confirmar finaliza la serie, sin acciones ni próxima fecha (US4-2)', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE] })
    updateRecurringExpenseStatus.mockResolvedValue({
      ok: true,
      expense: { ...ACTIVE, status: 'FINISHED', nextOccurrenceDate: undefined },
    })
    renderPage()
    await screen.findByTestId('recurring-81')

    await user.click(item(81).getByRole('button', { name: 'Finalizar' }))
    await user.click(screen.getByRole('button', { name: 'Sí, finalizar' }))

    expect(updateRecurringExpenseStatus).toHaveBeenCalledWith(81, 'FINISHED')
    expect(await screen.findByTestId('snackbar')).toHaveTextContent(
      FINISHED_MESSAGE,
    )
    expect(item(81).getByText('Finalizado')).toBeInTheDocument()
    expect(item(81).queryAllByRole('button')).toHaveLength(0)
    expect(item(81).queryByText(/Próxima fecha/)).not.toBeInTheDocument()
  })

  it('ante 409 muestra el detalle y recarga la lista (FR-014)', async () => {
    const user = userEvent.setup()
    listRecurringExpenses
      .mockResolvedValueOnce({ ok: true, expenses: [PAUSED] })
      .mockResolvedValueOnce({ ok: true, expenses: [{ ...PAUSED, status: 'FINISHED' }] })
    updateRecurringExpenseStatus.mockResolvedValue({
      ok: false,
      status: 409,
      detail: 'El gasto recurrente ya está finalizado y no puede modificarse',
      code: 'RECURRENCE_FINISHED',
    })
    renderPage()
    await screen.findByTestId('recurring-64')

    await user.click(item(64).getByRole('button', { name: 'Reanudar' }))

    expect(await screen.findByTestId('recurring-error')).toHaveTextContent(
      'El gasto recurrente ya está finalizado y no puede modificarse',
    )
    await waitFor(() => expect(listRecurringExpenses).toHaveBeenCalledTimes(2))
    expect(await item(64).findByText('Finalizado')).toBeInTheDocument()
    expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument()
  })

  it('ante fallo de red al cambiar conserva el estado y muestra el mensaje fijo', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE] })
    updateRecurringExpenseStatus.mockResolvedValue({ ok: false, network: true })
    renderPage()
    await screen.findByTestId('recurring-81')

    await user.click(item(81).getByRole('button', { name: 'Pausar' }))

    expect(await screen.findByTestId('recurring-error')).toHaveTextContent(
      'No se pudo actualizar el gasto recurrente. Intentá nuevamente',
    )
    expect(item(81).getByText('Activo')).toBeInTheDocument()
    expect(item(81).getByRole('button', { name: 'Pausar' })).toBeEnabled()
    expect(listRecurringExpenses).toHaveBeenCalledTimes(1)
  })

  it('ante 401 al cambiar ofrece iniciar sesión', async () => {
    const user = userEvent.setup()
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [ACTIVE] })
    updateRecurringExpenseStatus.mockResolvedValue({ ok: false, status: 401, detail: '', code: null })
    renderPage()
    await screen.findByTestId('recurring-81')

    await user.click(item(81).getByRole('button', { name: 'Pausar' }))

    const session = await screen.findByTestId('recurring-session')
    expect(session).toHaveTextContent(SESSION_EXPIRED_MESSAGE)
    expect(within(session).getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('sin series muestra el mensaje vacío con acceso al registro (US3-5)', async () => {
    listRecurringExpenses.mockResolvedValue({ ok: true, expenses: [] })
    renderPage()

    const empty = await screen.findByTestId('recurring-empty')
    expect(empty).toHaveTextContent(EMPTY_MESSAGE)
    expect(within(empty).getByRole('link', { name: 'Registrar gasto' })).toHaveAttribute(
      'href',
      '/expenses/new',
    )
  })

  it('ante un error al cargar ofrece reintentar', async () => {
    const user = userEvent.setup()
    listRecurringExpenses
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, expenses: [ACTIVE] })
    renderPage()

    const failure = await screen.findByTestId('recurring-load-error')
    expect(failure).toHaveTextContent(
      'No se pudieron cargar tus gastos recurrentes. Intentá nuevamente',
    )
    await user.click(within(failure).getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByTestId('recurring-81')).toBeInTheDocument()
  })

  it('si la sesión expiró al cargar ofrece iniciar sesión en lugar de reintentar', async () => {
    listRecurringExpenses.mockResolvedValue({ ok: false, status: 401 })
    renderPage()

    expect(await screen.findByTestId('recurring-session')).toHaveTextContent(
      SESSION_EXPIRED_MESSAGE,
    )
    expect(screen.queryByTestId('recurring-load-error')).not.toBeInTheDocument()
  })
})
