import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../api/expenseClient', async (importOriginal) => ({
  ...await importOriginal(),
  getExpense: vi.fn(),
}))
const setUser = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

import { EXPENSE_DETAIL_ERROR_MESSAGE, getExpense } from '../api/expenseClient'
import ExpenseDetailPage, { NO_DESCRIPTION_LABEL, NOT_FOUND_MESSAGE } from './ExpenseDetailPage'

const ONE_TIME = {
  id: 4,
  amount: '8000.00',
  currency: 'ARS',
  date: '2026-11-14',
  category: 'FOOD',
  type: 'ONE_TIME',
  paymentMethod: 'CASH',
  conversions: [{ currency: 'USD', amount: '5.18' }],
}

const RECURRING = {
  id: 7,
  amount: '15000.00',
  currency: 'ARS',
  date: '2026-11-01',
  category: 'SERVICES',
  type: 'RECURRING',
  paymentMethod: 'DEBIT_CARD',
  description: 'Internet hogar',
  frequency: 'MONTHLY',
  status: 'ACTIVE',
  nextOccurrenceDate: '2026-12-01',
}

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/expenses/4', state }]}>
      <Routes>
        <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getExpense.mockReset()
  setUser.mockReset()
})

describe('ExpenseDetailPage (031)', () => {
  it('muestra todos los datos de un gasto único', async () => {
    getExpense.mockResolvedValue({ ok: true, expense: ONE_TIME })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Alimentos' })).toBeInTheDocument()
    expect(getExpense).toHaveBeenCalledWith('4')
    expect(screen.getByText('ARS 8.000,00')).toBeInTheDocument()
    expect(screen.getByText('≈ USD 5,18')).toBeInTheDocument()
    expect(screen.getByText('14/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('Único')).toBeInTheDocument()
    expect(screen.getByText(NO_DESCRIPTION_LABEL)).toBeInTheDocument()
    expect(screen.queryByText('Frecuencia')).not.toBeInTheDocument()
  })

  it('muestra frecuencia, estado y próxima fecha de un gasto recurrente activo', async () => {
    getExpense.mockResolvedValue({ ok: true, expense: RECURRING })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Internet hogar' })).toBeInTheDocument()
    expect(screen.getByText('Mensual')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('01/12/2026')).toBeInTheDocument()
  })

  it('no muestra próxima fecha de una serie pausada', async () => {
    getExpense.mockResolvedValue({ ok: true, expense: { ...RECURRING, status: 'PAUSED' } })

    renderPage()

    expect(await screen.findByText('Pausado')).toBeInTheDocument()
    expect(screen.queryByText('Próxima fecha')).not.toBeInTheDocument()
  })

  it('"Volver" regresa a la búsqueda de la que vino', async () => {
    getExpense.mockResolvedValue({ ok: true, expense: ONE_TIME })

    renderPage({ from: '/activity?q=pizza&year=2025' })

    expect(await screen.findByRole('link', { name: /Volver/ })).toHaveAttribute(
      'href',
      '/activity?q=pizza&year=2025',
    )
  })

  it('sin origen válido, "Volver" va a la actividad', async () => {
    getExpense.mockResolvedValue({ ok: true, expense: ONE_TIME })

    renderPage({ from: 'https://otro.sitio' })

    expect(await screen.findByRole('link', { name: /Volver/ })).toHaveAttribute('href', '/activity')
  })

  it('un gasto inexistente o ajeno muestra "No encontramos ese gasto"', async () => {
    getExpense.mockResolvedValue({ ok: false, status: 404 })

    renderPage()

    expect(await screen.findByText(NOT_FOUND_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detalle del gasto' })).toBeInTheDocument()
  })

  it('ante un error permite reintentar', async () => {
    getExpense.mockResolvedValueOnce({ ok: false, network: true })
    getExpense.mockResolvedValueOnce({ ok: true, expense: ONE_TIME })
    const user = userEvent.setup()

    renderPage()
    expect(await screen.findByText(EXPENSE_DETAIL_ERROR_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('ARS 8.000,00')).toBeInTheDocument()
  })

  it('una sesión vencida cierra la sesión', async () => {
    getExpense.mockResolvedValue({ ok: false, status: 401 })

    renderPage()

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})
