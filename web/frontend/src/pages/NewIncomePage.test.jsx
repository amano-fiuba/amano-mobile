import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/authClient', () => ({ me: vi.fn() }))
vi.mock('../api/incomeClient', async (importOriginal) => ({
  ...await importOriginal(),
  createIncome: vi.fn(),
}))
vi.mock('../api/currencyClient', () => ({
  getCurrencyQuote: vi.fn().mockResolvedValue({ ok: false }),
  listCurrencies: vi.fn().mockResolvedValue({ ok: true, currencies: [] }),
}))

import { me } from '../api/authClient'
import { createIncome } from '../api/incomeClient'
import { SnackbarProvider } from '../components/Snackbar'
import { currentDateIn, deviceTimeZone } from '../hooks/useCurrentDate'
import { PROFILE_FALLBACK_NOTICE } from '../hooks/usePersonalFormDefaults'
import NewIncomePage from './NewIncomePage'

function ActivityProbe() {
  const location = useLocation()
  return (
    <output data-testid="activity">
      {`actividad:${location.state?.refreshBalance ? 'refrescar' : 'sin-refresco'}${location.search}`}
    </output>
  )
}

function renderPage() {
  return render(
    <SnackbarProvider>
      <MemoryRouter initialEntries={['/', '/incomes/new']} initialIndex={1}>
        <Routes>
          <Route path="/" element={<p>Pantalla principal</p>} />
          <Route path="/incomes/new" element={<NewIncomePage />} />
          <Route path="/activity" element={<ActivityProbe />} />
        </Routes>
      </MemoryRouter>
    </SnackbarProvider>,
  )
}

beforeEach(() => {
  me.mockReset()
  createIncome.mockReset()
})

describe('NewIncomePage (033)', () => {
  it('muestra "Nuevo ingreso" con la moneda preferida y la fecha de hoy', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: ['USD'] } })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Nuevo ingreso' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Moneda')).toHaveValue('USD'))
    expect(screen.getByLabelText('Fecha')).toHaveValue(currentDateIn(deviceTimeZone()))
    expect(screen.getByLabelText('Medio de cobro')).toBeInTheDocument()
  })

  it('sin conexión usa ARS y avisa sin bloquear', async () => {
    me.mockResolvedValue({ ok: false, network: true })

    renderPage()

    expect(await screen.findByTestId('currency-notice')).toHaveTextContent(PROFILE_FALLBACK_NOTICE)
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
  })

  it('"Cancelar" vuelve a la pantalla anterior', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: [] } })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(me).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Pantalla principal')).toBeInTheDocument()
  })

  it('al guardar con éxito va a /activity?view=incomes con state.refreshBalance', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: [] } })
    createIncome.mockResolvedValue({ ok: true, income: { id: 1 } })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(me).toHaveBeenCalled())

    await user.type(screen.getByLabelText('Monto'), '1000')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'FREELANCE')
    await user.selectOptions(screen.getByLabelText('Medio de cobro'), 'CASH')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByTestId('activity')).toHaveTextContent('actividad:refrescar?view=incomes')
    expect(createIncome).toHaveBeenCalledTimes(1)
  })

  it('si guardar falla se queda en el formulario', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: [] } })
    createIncome.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(me).toHaveBeenCalled())

    await user.type(screen.getByLabelText('Monto'), '1000')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'FREELANCE')
    await user.selectOptions(screen.getByLabelText('Medio de cobro'), 'CASH')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByTestId('expense-error')).toBeInTheDocument()
    expect(screen.queryByTestId('activity')).not.toBeInTheDocument()
  })
})
