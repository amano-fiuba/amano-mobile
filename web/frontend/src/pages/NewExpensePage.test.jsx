import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/authClient', () => ({
  me: vi.fn(),
}))
vi.mock('../api/expenseClient', async (importOriginal) => ({
  ...await importOriginal(),
  createExpense: vi.fn(),
}))
vi.mock('../api/currencyClient', () => ({
  getCurrencyQuote: vi.fn().mockResolvedValue({ ok: false }),
  listCurrencies: vi.fn().mockResolvedValue({ ok: true, currencies: [] }),
}))

import { me } from '../api/authClient'
import { createExpense } from '../api/expenseClient'
import { SnackbarProvider } from '../components/Snackbar'
import { AuthProvider } from '../auth/AuthContext'
import { AppRoutes } from '../App'
import NewExpensePage, { PROFILE_FALLBACK_NOTICE } from './NewExpensePage'
import { currentDateIn, deviceTimeZone } from '../hooks/useCurrentDate'

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
      <MemoryRouter initialEntries={['/', '/expenses/new']} initialIndex={1}>
        <Routes>
          <Route path="/" element={<p>Pantalla principal</p>} />
          <Route path="/expenses/new" element={<NewExpensePage />} />
          <Route path="/activity" element={<ActivityProbe />} />
        </Routes>
      </MemoryRouter>
    </SnackbarProvider>,
  )
}

async function fillAndConfirm(user) {
  await user.type(screen.getByLabelText('Monto'), '1000')
  await user.selectOptions(screen.getByLabelText('Categoría'), 'FOOD')
  await user.selectOptions(screen.getByLabelText('Tipo de gasto'), 'ONE_TIME')
  await user.selectOptions(screen.getByLabelText('Medio de pago'), 'CASH')
  await user.click(screen.getByRole('button', { name: 'Guardar' }))
  await user.click(await screen.findByRole('button', { name: 'Confirmar' }))
}

beforeEach(() => {
  me.mockReset()
  createExpense.mockReset()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('NewExpensePage (T027/T031)', () => {
  it('precarga la moneda preferida del perfil y la fecha del día actual', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: ['USD'] } })

    renderPage()

    await waitFor(() => expect(screen.getByLabelText('Moneda')).toHaveValue('USD'))
    expect(screen.getByLabelText('Fecha')).toHaveValue(currentDateIn(deviceTimeZone()))
  })

  it.each([
    ['perfil ausente', undefined],
    ['lista vacía', []],
    ['valor no soportado', ['XAU']],
  ])('usa ARS con %s', async (_label, currencies) => {
    me.mockResolvedValue({ ok: true, profile: { currencies } })

    renderPage()

    await waitFor(() => expect(me).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
  })

  it('al guardar con éxito va a /activity?view=expenses con state.refreshBalance', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: [] } })
    createExpense.mockResolvedValue({ ok: true, expense: { id: 1 } })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(me).toHaveBeenCalled())

    await fillAndConfirm(user)

    expect(await screen.findByTestId('activity')).toHaveTextContent('actividad:refrescar?view=expenses')
    expect(createExpense).toHaveBeenCalledTimes(1)
  })

  it('si guardar falla se queda en el formulario', async () => {
    me.mockResolvedValue({ ok: true, profile: { currencies: [] } })
    createExpense.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(me).toHaveBeenCalled())

    await fillAndConfirm(user)

    expect(await screen.findByTestId('expense-error')).toBeInTheDocument()
    expect(screen.queryByTestId('activity')).not.toBeInTheDocument()
  })

  it('sin conexión usa ARS y muestra un aviso no bloqueante', async () => {
    me.mockResolvedValue({ ok: false, network: true })

    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent(PROFILE_FALLBACK_NOTICE)
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('actualiza la fecha al cruzar la medianoche solo si no fue modificada (US1-12)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-21T15:00:00Z'))
    me.mockResolvedValue({ ok: true, profile: { currencies: ['USD'] } })
    const zone = deviceTimeZone()

    renderPage()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const initialDate = currentDateIn(zone)
    expect(screen.getByLabelText('Fecha')).toHaveValue(initialDate)

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    })

    const nextDate = currentDateIn(zone)
    expect(nextDate).not.toBe(initialDate)
    expect(screen.getByLabelText('Fecha')).toHaveValue(nextDate)

    const dateInput = screen.getByLabelText('Fecha')
    fireEvent.change(dateInput, { target: { value: '01/01/2026' } })

    act(() => {
      vi.advanceTimersByTime(25 * 60 * 60 * 1000)
    })

    expect(screen.getByLabelText('Fecha')).toHaveValue('01/01/2026')
  })

  it('/expenses/new sin sesión redirige al login por ProtectedRoute (401)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/expenses/new']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
    expect(me).not.toHaveBeenCalled()
  })
})
