import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  listGroupRecurringExpenses: vi.fn(),
  updateGroupRecurringExpense: vi.fn(),
}))

import {
  listGroupRecurringExpenses,
  updateGroupRecurringExpense,
} from '../../api/groupsClient'
import { SnackbarProvider } from '../../components/Snackbar'
import GroupRecurringExpensesPage, {
  EMPTY_MESSAGE,
  FINISHED_MESSAGE,
  FINISH_CONFIRMATION_MESSAGE,
  FREQUENCY_MESSAGE,
  LOAD_ERROR_MESSAGE,
  PAUSED_MESSAGE,
  PAUSE_CONFIRMATION_MESSAGE,
  RESUMED_MESSAGE,
  RESUME_CONFIRMATION_MESSAGE,
} from './GroupRecurringExpensesPage'

const SERIES = {
  id: 7,
  amount: '50000.00',
  currency: 'ARS',
  date: '2026-11-02',
  category: 'HOUSING',
  type: 'RECURRING',
  paymentMethod: 'TRANSFER',
  description: 'Alquiler',
  frequency: 'WEEKLY',
  status: 'ACTIVE',
  nextOccurrenceDate: '2026-11-16',
  nextDueDate: '2026-11-23',
  accumulatedAmount: '100000.00',
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/groups/3/recurring-expenses']}>
      <SnackbarProvider>
        <Routes>
          <Route path="/groups/:id/recurring-expenses" element={<GroupRecurringExpensesPage />} />
        </Routes>
      </SnackbarProvider>
    </MemoryRouter>,
  )
}

function confirmButton() {
  return screen.getByRole('button', { name: 'Sí, confirmar' })
}

beforeEach(() => {
  listGroupRecurringExpenses.mockReset()
  updateGroupRecurringExpense.mockReset()
  listGroupRecurringExpenses.mockResolvedValue({ ok: true, series: [SERIES] })
  updateGroupRecurringExpense.mockImplementation(async (groupId, seriesId, payload) => ({
    ok: true,
    series: { ...SERIES, ...payload },
  }))
})

describe('GroupRecurringExpensesPage (028/029)', () => {
  it('lista las series del grupo con su estado, frecuencia, acumulado y vencimiento', async () => {
    renderPage()

    expect(await screen.findByText('Alquiler')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText(/50\.000,00 ARS · Vivienda · Semanal/)).toBeInTheDocument()
    expect(screen.getByText(/Desde 02\/11\/2026 · Próxima fecha: 16\/11\/2026 · Vence: 23\/11\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Acumulado: 100\.000,00 ARS/)).toBeInTheDocument()
    expect(screen.getByLabelText('Frecuencia de Alquiler')).toHaveValue('WEEKLY')
    expect(screen.getByRole('link', { name: 'Alquiler' })).toHaveAttribute('href', '/groups/3/expenses/7')
  })

  it('pausa una serie activa previa confirmación', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }))

    const confirm = screen.getByRole('group', { name: 'Confirmar pausar' })
    expect(confirm).toHaveTextContent(PAUSE_CONFIRMATION_MESSAGE)
    fireEvent.click(confirmButton())

    await waitFor(() => expect(updateGroupRecurringExpense).toHaveBeenCalledWith(
      '3', 7, { status: 'PAUSED' },
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(PAUSED_MESSAGE)
    expect(screen.getByText('Pausado')).toBeInTheDocument()
  })

  it('cancelar la confirmación de pausa no envía nada', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Pausar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('group')).not.toBeInTheDocument())
    expect(updateGroupRecurringExpense).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
  })

  it('reanuda una serie pausada previa confirmación de reinicio', async () => {
    listGroupRecurringExpenses.mockResolvedValue({
      ok: true,
      series: [{ ...SERIES, status: 'PAUSED', nextOccurrenceDate: null, nextDueDate: null }],
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Reanudar' }))

    const confirm = screen.getByRole('group', { name: 'Confirmar reanudar' })
    expect(confirm).toHaveTextContent(RESUME_CONFIRMATION_MESSAGE)
    fireEvent.click(confirmButton())

    await waitFor(() => expect(updateGroupRecurringExpense).toHaveBeenCalledWith(
      '3', 7, { status: 'ACTIVE' },
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(RESUMED_MESSAGE)
  })

  it('finaliza una serie activa previa confirmación definitiva', async () => {
    updateGroupRecurringExpense.mockResolvedValue({
      ok: true,
      series: { ...SERIES, status: 'FINISHED', nextOccurrenceDate: null, nextDueDate: null },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar' }))

    const confirm = screen.getByRole('group', { name: 'Confirmar finalizar' })
    expect(confirm).toHaveTextContent(FINISH_CONFIRMATION_MESSAGE)
    fireEvent.click(confirmButton())

    await waitFor(() => expect(updateGroupRecurringExpense).toHaveBeenCalledWith(
      '3', 7, { status: 'FINISHED' },
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(FINISHED_MESSAGE)
    expect(screen.getByText('Finalizado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Frecuencia de Alquiler')).not.toBeInTheDocument()
  })

  it('cambia la frecuencia de la serie sin pedir confirmación', async () => {
    updateGroupRecurringExpense.mockResolvedValue({
      ok: true,
      series: { ...SERIES, frequency: 'MONTHLY', nextOccurrenceDate: '2026-12-02', nextDueDate: '2026-12-02' },
    })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Frecuencia de Alquiler'), {
      target: { value: 'MONTHLY' },
    })

    await waitFor(() => expect(updateGroupRecurringExpense).toHaveBeenCalledWith(
      '3', 7, { frequency: 'MONTHLY' },
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(FREQUENCY_MESSAGE)
    expect(screen.getByText(/02\/12\/2026/)).toBeInTheDocument()
  })

  it('muestra el estado vacío', async () => {
    listGroupRecurringExpenses.mockResolvedValue({ ok: true, series: [] })
    renderPage()

    expect(await screen.findByTestId('group-recurring-empty')).toHaveTextContent(EMPTY_MESSAGE)
  })

  it('muestra el error de carga y permite reintentar', async () => {
    listGroupRecurringExpenses
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, series: [SERIES] })
    renderPage()

    expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Alquiler')).toBeInTheDocument()
  })
})
