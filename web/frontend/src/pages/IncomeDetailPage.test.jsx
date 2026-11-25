import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../api/incomeClient', async (importOriginal) => ({
  ...await importOriginal(),
  getIncome: vi.fn(),
}))
const setUser = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

import { INCOME_DETAIL_ERROR_MESSAGE, getIncome } from '../api/incomeClient'
import IncomeDetailPage, {
  INCOME_NOT_FOUND_MESSAGE,
  NO_DESCRIPTION_LABEL,
  PROJECTED_LABEL,
} from './IncomeDetailPage'

const SALARY = {
  id: 4,
  amount: '850000.00',
  currency: 'ARS',
  date: '2026-11-03',
  category: 'SALARY',
  paymentMethod: 'TRANSFER',
  description: 'Sueldo octubre',
  projected: false,
  conversions: [{ currency: 'USD', amount: '560.00' }],
}

function renderPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/incomes/4', state }]}>
      <Routes>
        <Route path="/incomes/:id" element={<IncomeDetailPage />} />
        <Route path="/activity" element={<p>Actividad</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  getIncome.mockReset()
  setUser.mockReset()
})

describe('IncomeDetailPage (033, FR-016)', () => {
  it('muestra todos los datos de un ingreso con su equivalente', async () => {
    getIncome.mockResolvedValue({ ok: true, income: SALARY })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Sueldo octubre' })).toBeInTheDocument()
    expect(getIncome).toHaveBeenCalledWith('4')
    expect(screen.getByText('ARS 850.000,00')).toBeInTheDocument()
    expect(screen.getByText('≈ USD 560,00')).toBeInTheDocument()
    expect(screen.getByText('03/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Sueldo')).toBeInTheDocument()
    expect(screen.getByText('Transferencia')).toBeInTheDocument()
    expect(screen.queryByTestId('projected-badge')).not.toBeInTheDocument()
  })

  it('sin descripción usa la categoría de título y avisa "Sin descripción"', async () => {
    getIncome.mockResolvedValue({
      ok: true,
      income: { ...SALARY, description: undefined, category: 'REFUND', conversions: [] },
    })

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Reembolso' })).toBeInTheDocument()
    expect(screen.getByText(NO_DESCRIPTION_LABEL)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Equivalencias' })).not.toBeInTheDocument()
  })

  it('marca "Proyectado" un ingreso con fecha futura', async () => {
    getIncome.mockResolvedValue({
      ok: true,
      income: { ...SALARY, projected: true, date: '2027-01-15' },
    })

    renderPage()

    expect(await screen.findByTestId('projected-badge')).toHaveTextContent(PROJECTED_LABEL)
    expect(screen.getByText(/15\/01\/2027/)).toBeInTheDocument()
  })

  it('es de solo lectura: no ofrece editar ni eliminar', async () => {
    getIncome.mockResolvedValue({ ok: true, income: SALARY })

    renderPage()
    await screen.findByTestId('income-detail')

    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /editar|eliminar|borrar/i })).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getAllByRole('link')).toHaveLength(1)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('un 404 (inexistente, ajeno o no numérico) muestra que no se encontró', async () => {
    getIncome.mockResolvedValue({ ok: false, status: 404 })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(INCOME_NOT_FOUND_MESSAGE)
    expect(screen.queryByTestId('income-detail')).not.toBeInTheDocument()
  })

  it('un 400 se trata igual que un 404', async () => {
    getIncome.mockResolvedValue({ ok: false, status: 400 })

    renderPage()

    expect(await screen.findByText(INCOME_NOT_FOUND_MESSAGE)).toBeInTheDocument()
  })

  it('ante un error permite reintentar', async () => {
    getIncome
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, income: SALARY })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(INCOME_DETAIL_ERROR_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByTestId('income-detail')).toBeInTheDocument()
    expect(getIncome).toHaveBeenCalledTimes(2)
  })

  it('una sesión vencida cierra la sesión', async () => {
    getIncome.mockResolvedValue({ ok: false, status: 401 })

    renderPage()

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('mientras carga muestra "Cargando…"', () => {
    getIncome.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detalle del ingreso' })).toBeInTheDocument()
  })

  it('"Volver" regresa a la actividad con la búsqueda en vigor, o a /activity sin ella', async () => {
    getIncome.mockResolvedValue({ ok: true, income: SALARY })
    const { unmount } = renderPage({ from: '/activity?view=incomes&q=sueldo' })
    expect(await screen.findByRole('link', { name: /Volver/ })).toHaveAttribute(
      'href',
      '/activity?view=incomes&q=sueldo',
    )
    unmount()

    renderPage({ from: 'https://otro-sitio.example/' })
    expect(await screen.findByRole('link', { name: /Volver/ })).toHaveAttribute('href', '/activity')
  })

  it('no ofrece botones ni enlaces para editar o eliminar el ingreso (US3)', async () => {
    getIncome.mockResolvedValue({ ok: true, income: SALARY })

    renderPage()

    await screen.findByRole('heading', { name: 'Sueldo octubre' })
    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar|modificar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /editar|eliminar|borrar|modificar/i })).not.toBeInTheDocument()
  })
})
