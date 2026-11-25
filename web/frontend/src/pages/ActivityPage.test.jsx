import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'

vi.mock('../api/expenseClient', async (importOriginal) => ({
  ...await importOriginal(),
  searchExpenses: vi.fn(),
  listExpenseYears: vi.fn(),
}))
vi.mock('../api/incomeClient', async (importOriginal) => ({
  ...await importOriginal(),
  getBalance: vi.fn(),
  searchIncomes: vi.fn(),
  listIncomeYears: vi.fn(),
}))
const setUser = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

import {
  SEARCH_INCOMES_ERROR_MESSAGE,
  getBalance,
  listIncomeYears,
  searchIncomes,
} from '../api/incomeClient'
import {
  listExpenseYears,
  SEARCH_EXPENSES_ERROR_MESSAGE,
  searchExpenses,
} from '../api/expenseClient'
import ActivityPage, {
  NO_RESULTS_MESSAGE,
  SEARCH_PLACEHOLDER,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  TOO_SHORT_MESSAGE,
} from './ActivityPage'

const YEAR = String(new Date().getFullYear())
// jsdom's default window height (768 px) fits 7 cards with the estimated card height.
const DEFAULT_HEIGHT = 768
const SIZE = 7

/** Arguments of searchExpenses for some criteria; the rest are the defaults. */
function query(overrides = {}) {
  return { term: '', year: YEAR, month: null, page: 1, size: SIZE, ...overrides }
}

/** A page of the search answer; by default the asked page exists. */
function pageOf(expenses, { page = 1, totalElements = expenses.length, totalPages = page } = {}) {
  return { ok: true, expenses, page, totalElements, totalPages }
}

function setWindowHeight(height) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
}

const PIZZA = {
  id: 1,
  description: 'Pizza',
  category: 'FOOD',
  paymentMethod: 'CASH',
  date: '2026-11-02',
  currency: 'ARS',
  amount: '1500.00',
}

const SUELDO = {
  id: 7,
  description: 'Sueldo octubre',
  category: 'SALARY',
  paymentMethod: 'TRANSFER',
  date: '2026-11-03',
  currency: 'ARS',
  amount: '850000.00',
  projected: false,
}

/** A page of the income search answer; by default the asked page exists. */
function incomePageOf(incomes, { page = 1, totalElements = incomes.length, totalPages = page } = {}) {
  return { ok: true, incomes, page, totalElements, totalPages }
}

const BALANCE = {
  currency: 'ARS',
  income: '1000.00',
  projectedIncome: '0.00',
  expenses: '400.00',
  net: '600.00',
}

function RefreshButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/activity', { state: { refreshBalance: 222 } })}
    >
      Simular alta
    </button>
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function DetailProbe() {
  const location = useLocation()
  return <p>Detalle desde {location.state?.from}</p>
}

function renderPage(entry = '/activity') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/activity"
          element={
            <>
              <ActivityPage />
              <LocationProbe />
              <RefreshButton />
            </>
          }
        />
        <Route path="/expenses/:id" element={<DetailProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const searchbox = () => screen.getByRole('searchbox', { name: SEARCH_PLACEHOLDER })
const yearSelect = () => screen.getByRole('combobox', { name: 'Año' })
const monthSelect = () => screen.getByRole('combobox', { name: 'Mes' })
const location = () => screen.getByTestId('location')

beforeEach(() => {
  searchExpenses.mockReset()
  listExpenseYears.mockReset()
  setUser.mockReset()
  setWindowHeight(DEFAULT_HEIGHT)
  searchExpenses.mockImplementation(async ({ page }) => pageOf([PIZZA], { page }))
  listExpenseYears.mockResolvedValue({ ok: true, years: [] })
  getBalance.mockReset()
  getBalance.mockResolvedValue({ ok: true, balance: BALANCE })
  searchIncomes.mockReset()
  searchIncomes.mockImplementation(async ({ page }) => incomePageOf([SUELDO], { page }))
  listIncomeYears.mockReset()
  listIncomeYears.mockResolvedValue({ ok: true, years: [] })
})

describe('ActivityPage (031)', () => {
  it('al entrar muestra los gastos del año actual como tarjetas con enlace al detalle', async () => {
    renderPage()

    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    expect(searchExpenses).toHaveBeenCalledWith(query())
    expect(yearSelect()).toHaveValue(YEAR)
    expect(searchbox()).toHaveAttribute('placeholder', SEARCH_PLACEHOLDER)
    expect(screen.getByText('ARS 1.500,00')).toBeInTheDocument()
    expect(screen.getByText(/02\/11\/2026 · Alimentos · Efectivo/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pizza/ })).toHaveAttribute('href', '/expenses/1')
    expect(screen.queryByRole('button', { name: 'Limpiar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
    expect(screen.queryByText(/resultado/)).not.toBeInTheDocument()
  })

  it('muestra las conversiones y la categoría cuando no hay descripción', async () => {
    searchExpenses.mockResolvedValue({
      ok: true,
      page: 1,
      totalElements: 1,
      totalPages: 1,
      expenses: [
        {
          ...PIZZA,
          description: undefined,
          currency: 'USD',
          amount: '100.00',
          conversions: [{ currency: 'ARS', amount: '150000.00' }],
        },
      ],
    })

    renderPage()

    expect(await screen.findByText('≈ ARS 150.000,00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Alimentos/ })).toBeInTheDocument()
  })

  it('busca al dejar de escribir, mostrando "Buscando…" mientras tanto', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')

    await user.type(searchbox(), 'farma')

    expect(screen.getByText('Buscando…')).toBeInTheDocument()
    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ term: 'farma' })))
    expect(await screen.findByText('1 resultado')).toBeInTheDocument()
    expect(searchExpenses).not.toHaveBeenCalledWith(query({ term: 'f' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/activity?q=farma')
  })

  it('Enter busca sin esperar la pausa', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')

    await user.type(searchbox(), 'pizza{Enter}')

    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ term: 'pizza' })), {
      timeout: 200,
    })
  })

  it('con un solo carácter avisa el mínimo y no busca por texto', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')

    await user.type(searchbox(), ' f {Enter}')

    expect(screen.getByText(TOO_SHORT_MESSAGE)).toBeInTheDocument()
    expect(searchExpenses).toHaveBeenCalledTimes(1)
  })

  it('informa cuando no hay coincidencias', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')
    searchExpenses.mockResolvedValue(pageOf([], { totalPages: 0 }))

    await user.type(searchbox(), 'xyz{Enter}')

    expect(await screen.findByText(NO_RESULTS_MESSAGE)).toBeInTheDocument()
  })

  it('borrar el texto muestra de inmediato el año elegido', async () => {
    const user = userEvent.setup()
    renderPage(`/activity?q=pizza&year=2025`)
    await screen.findByText('1 resultado')
    expect(searchbox()).toHaveValue('pizza')
    expect(yearSelect()).toHaveValue('2025')

    await user.clear(searchbox())

    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: '2025' })), {
      timeout: 200,
    })
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/activity\?year=2025$/)
    await waitFor(() => expect(screen.queryByText('1 resultado')).not.toBeInTheDocument())
  })

  it('cambiar el año consulta de inmediato, con o sin texto', async () => {
    listExpenseYears.mockResolvedValue({ ok: true, years: [2024] })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')
    const options = within(yearSelect()).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual([YEAR, '2024', 'Todos los años'])

    await user.selectOptions(yearSelect(), '2024')
    expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: '2024' }))

    await user.selectOptions(yearSelect(), 'all')
    expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: null }))

    await user.type(searchbox(), 'pizza{Enter}')
    await user.selectOptions(yearSelect(), YEAR)
    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ term: 'pizza' })))
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/activity\?q=pizza$/)
  })

  it('un año inválido en la dirección se toma como el actual y uno sin gastos se ofrece igual', async () => {
    renderPage('/activity?q=pizza&year=20x5')
    await screen.findByText('Pizza')
    expect(searchExpenses).toHaveBeenCalledWith(query({ term: 'pizza' }))
  })

  it('ofrece el año de la dirección aunque no tenga gastos', async () => {
    renderPage('/activity?year=2019')
    await screen.findByText('Pizza')
    expect(yearSelect()).toHaveValue('2019')
  })

  it('sin gastos en el año ofrece registrar uno', async () => {
    searchExpenses.mockResolvedValue(pageOf([], { totalPages: 0 }))

    renderPage()

    expect(await screen.findByText(`No registraste gastos en ${YEAR}.`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar un gasto' })).toHaveAttribute(
      'href',
      '/expenses/new',
    )
  })

  it('sin gastos en ningún año lo dice así', async () => {
    searchExpenses.mockResolvedValue(pageOf([], { totalPages: 0 }))

    renderPage('/activity?year=all')

    expect(await screen.findByText('Todavía no registraste gastos.')).toBeInTheDocument()
  })

  it('ante un error permite reintentar', async () => {
    searchExpenses.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(SEARCH_EXPENSES_ERROR_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    expect(searchExpenses).toHaveBeenCalledTimes(2)
  })

  it('una sesión vencida cierra la sesión', async () => {
    searchExpenses.mockResolvedValue({ ok: false, status: 401 })

    renderPage()

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })

  it('si los años no cargan, ofrece el actual y todos', async () => {
    listExpenseYears.mockResolvedValue({ ok: false, network: true })

    renderPage()
    await screen.findByText('Pizza')

    const options = within(yearSelect()).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual([YEAR, 'Todos los años'])
  })

  it('el detalle recibe la dirección de la búsqueda para volver', async () => {
    const user = userEvent.setup()
    renderPage('/activity?q=pizza&year=2025')

    await user.click(await screen.findByRole('link', { name: /Pizza/ }))

    expect(screen.getByText('Detalle desde /activity?q=pizza&year=2025')).toBeInTheDocument()
  })
})

describe('ActivityPage: mes (031, FR-020)', () => {
  it('ofrece todos los meses y filtra por el elegido dentro del año', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')
    const options = within(monthSelect()).getAllByRole('option').map((option) => option.textContent)
    expect(options).toHaveLength(13)
    expect(options[0]).toBe('Todos los meses')
    expect(options[3]).toBe('Marzo')
    expect(monthSelect()).toHaveValue('')

    await user.selectOptions(monthSelect(), '3')

    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ month: '3' })))
    expect(location()).toHaveTextContent(/^\/activity\?month=3$/)
  })

  it('el mes de la dirección se aplica junto con el texto y el año', async () => {
    renderPage('/activity?q=pizza&year=2025&month=12')
    await screen.findByText('Pizza')

    expect(searchExpenses).toHaveBeenCalledWith(query({ term: 'pizza', year: '2025', month: '12' }))
    expect(monthSelect()).toHaveValue('12')
  })

  it('con "Todos los años" el mes queda deshabilitado y vuelve a todos', async () => {
    const user = userEvent.setup()
    renderPage('/activity?month=5')
    await screen.findByText('Pizza')
    expect(monthSelect()).toBeEnabled()

    await user.selectOptions(yearSelect(), 'all')

    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: null })))
    expect(monthSelect()).toBeDisabled()
    expect(monthSelect()).toHaveValue('')
    expect(location()).toHaveTextContent(/^\/activity\?year=all$/)
  })

  it('ignora un mes inválido o un mes con "Todos los años" en la dirección', async () => {
    renderPage('/activity?month=13')
    await screen.findByText('Pizza')
    expect(searchExpenses).toHaveBeenLastCalledWith(query())
    expect(monthSelect()).toHaveValue('')
  })

  it('ignora el mes de la dirección cuando el año es "Todos los años"', async () => {
    renderPage('/activity?year=all&month=3')
    await screen.findByText('Pizza')
    expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: null }))
    expect(monthSelect()).toBeDisabled()
  })

  it('sin gastos en el mes lo dice con el nombre del mes', async () => {
    searchExpenses.mockResolvedValue(pageOf([], { totalPages: 0 }))

    renderPage('/activity?year=2025&month=3')

    expect(await screen.findByText('No registraste gastos en marzo de 2025.')).toBeInTheDocument()
  })
})

describe('ActivityPage: paginación (031, FR-021..FR-023)', () => {
  const pagination = () => screen.getByRole('navigation', { name: 'Paginación' })
  const pageNumbers = () => pagination().querySelector('ol').textContent

  it('con una sola página no muestra la paginación', async () => {
    renderPage()
    await screen.findByText('Pizza')
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument()
  })

  it('con pocas páginas las muestra todas, sin "…"', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([PIZZA], { page, totalElements: 45, totalPages: 7 }))

    renderPage()
    await screen.findByText('Pizza')

    expect(pageNumbers()).toBe('1234567')
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: '‹ Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente ›' })).toBeEnabled()
  })

  it('con muchas páginas resume los saltos con "…"', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([PIZZA], { page, totalElements: 70, totalPages: 10 }))

    renderPage('/activity?page=5')
    await screen.findByText('Pizza')

    expect(searchExpenses).toHaveBeenCalledWith(query({ page: 5 }))
    expect(pageNumbers()).toBe('1…456…10')
    expect(screen.getByRole('button', { name: 'Página 5' })).toHaveAttribute('aria-current', 'page')
  })

  it('en la primera y la última página muestra un solo "…"', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([PIZZA], { page, totalElements: 70, totalPages: 10 }))

    const { unmount } = renderPage()
    await screen.findByText('Pizza')
    expect(pageNumbers()).toBe('12…10')
    unmount()

    renderPage('/activity?page=10')
    await screen.findByText('Pizza')
    expect(pageNumbers()).toBe('1…910')
    expect(screen.getByRole('button', { name: 'Siguiente ›' })).toBeDisabled()
  })

  it('los botones cambian de página y la guardan en la dirección', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([{ ...PIZZA, id: page, description: `Gasto ${page}` }],
        { page, totalElements: 70, totalPages: 10 }))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Gasto 1')

    await user.click(screen.getByRole('button', { name: 'Siguiente ›' }))
    expect(await screen.findByText('Gasto 2')).toBeInTheDocument()
    expect(searchExpenses).toHaveBeenLastCalledWith(query({ page: 2 }))
    expect(location()).toHaveTextContent(/^\/activity\?page=2$/)

    await user.click(screen.getByRole('button', { name: 'Página 10' }))
    expect(await screen.findByText('Gasto 10')).toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/activity\?page=10$/)

    await user.click(screen.getByRole('button', { name: '‹ Anterior' }))
    expect(await screen.findByText('Gasto 9')).toBeInTheDocument()
  })

  it('una página que ya no existe se reemplaza por la última', async () => {
    searchExpenses.mockResolvedValue(pageOf([PIZZA], { page: 3, totalElements: 15, totalPages: 3 }))

    renderPage('/activity?page=9')
    await screen.findByText('Pizza')

    expect(searchExpenses).toHaveBeenCalledWith(query({ page: 9 }))
    await waitFor(() => expect(location()).toHaveTextContent(/^\/activity\?page=3$/))
    expect(screen.getByRole('button', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page')
  })

  it('una página inválida en la dirección se toma como la primera', async () => {
    renderPage('/activity?page=abc')
    await screen.findByText('Pizza')
    expect(searchExpenses).toHaveBeenCalledWith(query())
  })

  it('el contador muestra el total de resultados, no solo los de la página', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([PIZZA], { page, totalElements: 23, totalPages: 4 }))

    renderPage('/activity?q=pizza')

    expect(await screen.findByText('23 resultados')).toBeInTheDocument()
  })

  it('cambiar el texto, el mes o el año vuelve a la página 1', async () => {
    searchExpenses.mockImplementation(async ({ page }) =>
      pageOf([PIZZA], { page, totalElements: 70, totalPages: 10 }))
    listExpenseYears.mockResolvedValue({ ok: true, years: [2024] })
    const user = userEvent.setup()

    renderPage('/activity?page=3')
    await screen.findByText('Pizza')
    await user.selectOptions(monthSelect(), '2')
    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(query({ month: '2' })))
    expect(location()).toHaveTextContent(/^\/activity\?month=2$/)

    await user.click(screen.getByRole('button', { name: 'Página 2' }))
    await waitFor(() => expect(location()).toHaveTextContent(/page=2/))
    await user.selectOptions(yearSelect(), '2024')
    await waitFor(() =>
      expect(searchExpenses).toHaveBeenLastCalledWith(query({ year: '2024', month: '2' })))
    expect(location()).toHaveTextContent(/^\/activity\?year=2024&month=2$/)

    await user.click(screen.getByRole('button', { name: 'Página 2' }))
    await waitFor(() => expect(location()).toHaveTextContent(/page=2/))
    await user.type(searchbox(), 'pizza{Enter}')
    await waitFor(() => expect(searchExpenses).toHaveBeenLastCalledWith(
      query({ term: 'pizza', year: '2024', month: '2' })))
    expect(location()).toHaveTextContent(/^\/activity\?q=pizza&year=2024&month=2$/)
  })
})

describe('ActivityPage: tamaño de página según el alto (031, FR-022)', () => {
  it.each([
    [400, MIN_PAGE_SIZE],
    [1000, 10],
    [3000, MAX_PAGE_SIZE],
  ])('con %i px de alto pide páginas de %i gastos', async (height, size) => {
    setWindowHeight(height)

    renderPage()
    await screen.findByText('Pizza')

    expect(searchExpenses).toHaveBeenCalledTimes(1)
    expect(searchExpenses).toHaveBeenCalledWith(query({ size }))
  })

  it('al cambiar el tamaño de la ventana recalcula y conserva el primer gasto a la vista', async () => {
    searchExpenses.mockImplementation(async ({ page, size }) =>
      pageOf([PIZZA], { page, totalElements: 70, totalPages: Math.ceil(70 / size) }))
    renderPage('/activity?page=3')
    await screen.findByText('Pizza')
    expect(searchExpenses).toHaveBeenLastCalledWith(query({ page: 3 }))

    // Page 3 of 7 starts at the 15th expense; with pages of 10 it is on page 2.
    act(() => {
      setWindowHeight(1000)
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() =>
      expect(searchExpenses).toHaveBeenLastCalledWith(query({ page: 2, size: 10 })))
    expect(location()).toHaveTextContent(/^\/activity\?page=2$/)
  })

  it('un cambio de alto que no cambia el tamaño no vuelve a consultar', async () => {
    renderPage()
    await screen.findByText('Pizza')

    act(() => {
      setWindowHeight(DEFAULT_HEIGHT + 10)
      window.dispatchEvent(new Event('resize'))
    })
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(searchExpenses).toHaveBeenCalledTimes(1)
  })
})

describe('ActivityPage: balance neto y nuevo ingreso (033)', () => {
  it('muestra la tarjeta de balance del año actual y, en gastos, el enlace a "Nuevo gasto"', async () => {
    renderPage()

    const card = await screen.findByTestId('balance-card')
    expect(await within(card).findByText('1.000,00 ARS')).toBeInTheDocument()
    expect(within(card).getByText('400,00 ARS')).toBeInTheDocument()
    expect(within(card).getByTestId('balance-net')).toHaveTextContent('+600,00 ARS')
    expect(getBalance).toHaveBeenCalledWith({ year: YEAR, month: undefined })
    expect(screen.getByRole('link', { name: 'Nuevo gasto' })).toHaveAttribute(
      'href',
      '/expenses/new',
    )
    expect(screen.queryByRole('link', { name: 'Nuevo ingreso' })).not.toBeInTheDocument()
  })

  it('el balance sigue el año y el mes elegidos, y "Todos los años" lo pide sin año', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')

    await user.selectOptions(monthSelect(), '3')
    await waitFor(() => expect(getBalance).toHaveBeenLastCalledWith({ year: YEAR, month: '3' }))

    await user.selectOptions(yearSelect(), 'all')
    await waitFor(() =>
      expect(getBalance).toHaveBeenLastCalledWith({ year: undefined, month: undefined }),
    )
  })

  it('al llegar con state.refreshBalance vuelve a pedir el balance y muestra el valor nuevo', async () => {
    getBalance
      .mockResolvedValueOnce({ ok: true, balance: BALANCE })
      .mockResolvedValueOnce({
        ok: true,
        balance: { ...BALANCE, income: '1850.00', net: '1450.00' },
      })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('1.000,00 ARS')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Simular alta' }))

    expect(await screen.findByText('1.850,00 ARS')).toBeInTheDocument()
    expect(screen.queryByText('1.000,00 ARS')).not.toBeInTheDocument()
    expect(screen.getByTestId('balance-net')).toHaveTextContent('+1.450,00 ARS')
    expect(getBalance).toHaveBeenCalledTimes(2)
  })

  it('si el balance falla ofrece reintentar sin afectar la lista de gastos', async () => {
    getBalance.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    const card = await screen.findByTestId('balance-card')
    await user.click(await within(card).findByRole('button', { name: 'Reintentar' }))

    expect(await within(screen.getByTestId('balance-card')).findByText('1.000,00 ARS'))
      .toBeInTheDocument()
  })
})

describe('ActivityPage: deep link de deuda (035 FR-017)', () => {
  it('hace scroll y resalta durante 2 s la transacción indicada por ?debt=', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    renderPage('/activity?debt=1')

    const title = await screen.findByText('Pizza')
    const row = title.closest('li')
    expect(row).toHaveAttribute('data-debt-id', '1')
    expect(row).toHaveAttribute('data-highlighted', 'true')
    expect(scrollIntoView).toHaveBeenCalled()
    await waitFor(() => expect(row).not.toHaveAttribute('data-highlighted'), { timeout: 3000 })
  })
})

describe('ActivityPage: vista Ingresos (033, US2)', () => {
  const incomesButton = () => screen.getByRole('button', { name: 'Ingresos' })
  const expensesButton = () => screen.getByRole('button', { name: 'Gastos' })

  it('empieza en Gastos y el control segmentado cambia a Ingresos con view=incomes', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')
    expect(expensesButton()).toHaveAttribute('aria-pressed', 'true')
    expect(incomesButton()).toHaveAttribute('aria-pressed', 'false')
    expect(searchIncomes).not.toHaveBeenCalled()

    await user.click(incomesButton())

    expect(await screen.findByText('Sueldo octubre')).toBeInTheDocument()
    expect(location()).toHaveTextContent('view=incomes')
    expect(incomesButton()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Pizza')).not.toBeInTheDocument()
    expect(searchIncomes).toHaveBeenCalledWith(query())
    expect(screen.getByRole('list', { name: 'Ingresos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nuevo ingreso' })).toHaveAttribute(
      'href',
      '/incomes/new',
    )
    expect(screen.queryByRole('link', { name: 'Nuevo gasto' })).not.toBeInTheDocument()
  })

  it('entrar con view=incomes muestra los ingresos como tarjetas con enlace al detalle', async () => {
    renderPage('/activity?view=incomes')

    const link = await screen.findByRole('link', { name: /Sueldo octubre/ })
    expect(link).toHaveAttribute('href', '/incomes/7')
    expect(screen.getByText('ARS 850.000,00')).toBeInTheDocument()
    expect(screen.getByText(/03\/11\/2026 · Sueldo · Transferencia/)).toBeInTheDocument()
    expect(screen.queryByTestId('projected-badge')).not.toBeInTheDocument()
    expect(searchExpenses).not.toHaveBeenCalled()
    expect(screen.getByTestId('balance-card')).toBeInTheDocument()
  })

  it('las filas de ingresos no tienen botones para editar o eliminar (US3)', async () => {
    renderPage('/activity?view=incomes')

    await screen.findByRole('link', { name: /Sueldo octubre/ })
    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar|modificar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /editar|eliminar|borrar|modificar/i })).not.toBeInTheDocument()
  })

  it('muestra la categoría sin descripción, las equivalencias y la insignia "Proyectado"', async () => {
    searchIncomes.mockResolvedValue(
      incomePageOf([
        {
          ...SUELDO,
          id: 8,
          description: undefined,
          category: 'FREELANCE',
          currency: 'USD',
          amount: '100.00',
          conversions: [{ currency: 'ARS', amount: '150000.00' }],
          projected: true,
          date: '2027-01-05',
        },
      ]),
    )

    renderPage('/activity?view=incomes')

    expect(await screen.findByText('Freelance')).toBeInTheDocument()
    expect(screen.getByText('USD 100,00')).toBeInTheDocument()
    expect(screen.getByText('≈ ARS 150.000,00')).toBeInTheDocument()
    expect(screen.getByTestId('projected-badge')).toHaveTextContent('Proyectado')
  })

  it('al cambiar de vista conserva el texto, el año y el mes, y vuelve sin view', async () => {
    const user = userEvent.setup()
    renderPage('/activity?q=sueldo&year=2024&month=3')
    await screen.findByText('Pizza')

    await user.click(incomesButton())

    await screen.findByText('Sueldo octubre')
    expect(location()).toHaveTextContent('q=sueldo')
    expect(location()).toHaveTextContent('year=2024')
    expect(location()).toHaveTextContent('month=3')
    expect(location()).toHaveTextContent('view=incomes')
    expect(searchIncomes).toHaveBeenLastCalledWith(
      query({ term: 'sueldo', year: '2024', month: '3' }),
    )
    expect(searchbox()).toHaveValue('sueldo')

    await user.click(expensesButton())

    await screen.findByText('Pizza')
    expect(location()).not.toHaveTextContent('view=')
    expect(location()).toHaveTextContent('q=sueldo')
  })

  it('volver a la misma vista no consulta de nuevo', async () => {
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')
    await screen.findByText('Sueldo octubre')
    searchIncomes.mockClear()

    await user.click(incomesButton())

    expect(searchIncomes).not.toHaveBeenCalled()
  })

  it('busca ingresos al escribir, mantiene la vista y muestra el contador', async () => {
    searchIncomes.mockImplementation(async ({ term }) =>
      term ? incomePageOf([SUELDO], { totalElements: 1 }) : incomePageOf([SUELDO]),
    )
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')
    await screen.findByText('Sueldo octubre')

    await user.type(searchbox(), 'sueldo{Enter}')

    await waitFor(() => expect(searchIncomes).toHaveBeenLastCalledWith(query({ term: 'sueldo' })))
    expect(await screen.findByText('1 resultado')).toBeInTheDocument()
    expect(location()).toHaveTextContent('view=incomes')
    expect(location()).toHaveTextContent('q=sueldo')
    expect(searchExpenses).not.toHaveBeenCalled()
  })

  it('sin coincidencias informa que no se encontraron resultados', async () => {
    searchIncomes.mockImplementation(async ({ term }) =>
      term ? incomePageOf([], { totalElements: 0, totalPages: 0 }) : incomePageOf([SUELDO]),
    )
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')
    await screen.findByText('Sueldo octubre')

    await user.type(searchbox(), 'zzz{Enter}')

    expect(await screen.findByText(NO_RESULTS_MESSAGE)).toBeInTheDocument()
  })

  it('el año y el mes se piden al backend y los años salen de los ingresos', async () => {
    listIncomeYears.mockResolvedValue({ ok: true, years: [2024, 2023] })
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')
    await screen.findByText('Sueldo octubre')

    await waitFor(() =>
      expect(within(yearSelect()).getAllByRole('option').map((option) => option.value)).toEqual(
        expect.arrayContaining([YEAR, '2024', '2023', 'all']),
      ),
    )
    expect(listIncomeYears).toHaveBeenCalled()
    expect(listExpenseYears).toHaveBeenCalledTimes(0)

    await user.selectOptions(yearSelect(), '2024')
    await waitFor(() => expect(searchIncomes).toHaveBeenLastCalledWith(query({ year: '2024' })))
    await user.selectOptions(monthSelect(), '5')
    await waitFor(() =>
      expect(searchIncomes).toHaveBeenLastCalledWith(query({ year: '2024', month: '5' })),
    )
    await user.selectOptions(yearSelect(), 'all')
    await waitFor(() =>
      expect(searchIncomes).toHaveBeenLastCalledWith(query({ year: null, month: null })),
    )
    expect(monthSelect()).toBeDisabled()
  })

  it('la lista de años sigue a la vista: gastos usa los años de gastos', async () => {
    listExpenseYears.mockResolvedValue({ ok: true, years: [2022] })
    listIncomeYears.mockResolvedValue({ ok: true, years: [2021] })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pizza')
    await waitFor(() => expect(within(yearSelect()).getByRole('option', { name: '2022' })).toBeInTheDocument())

    await user.click(incomesButton())

    await waitFor(() => expect(within(yearSelect()).getByRole('option', { name: '2021' })).toBeInTheDocument())
    expect(within(yearSelect()).queryByRole('option', { name: '2022' })).not.toBeInTheDocument()
  })

  it('sin ingresos en el año invita a registrar el primero', async () => {
    searchIncomes.mockResolvedValue(incomePageOf([], { totalElements: 0, totalPages: 0 }))

    renderPage('/activity?view=incomes')

    expect(await screen.findByText(new RegExp(`No registraste ingresos en ${YEAR}`))).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /Registrar un ingreso|Nuevo ingreso/ })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/incomes/new', '/incomes/new'])
  })

  it('con un mes o todos los años el vacío lo nombra', async () => {
    searchIncomes.mockResolvedValue(incomePageOf([], { totalElements: 0, totalPages: 0 }))

    const { unmount } = renderPage('/activity?view=incomes&month=3')
    expect(await screen.findByText(new RegExp(`No registraste ingresos en marzo de ${YEAR}`)))
      .toBeInTheDocument()
    unmount()

    renderPage('/activity?view=incomes&year=all')
    expect(await screen.findByText(/Todavía no registraste ingresos/)).toBeInTheDocument()
  })

  it('pagina los ingresos y conserva la vista en la dirección', async () => {
    searchIncomes.mockImplementation(async ({ page }) =>
      incomePageOf([{ ...SUELDO, id: page }], { page, totalElements: 14, totalPages: 2 }),
    )
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')
    await screen.findByRole('link', { name: /Sueldo octubre/ })

    await user.click(screen.getByRole('button', { name: 'Página 2' }))

    await waitFor(() => expect(searchIncomes).toHaveBeenLastCalledWith(query({ page: 2 })))
    expect(location()).toHaveTextContent('view=incomes')
    expect(location()).toHaveTextContent('page=2')
  })

  it('si la página pedida no existe adopta la que devuelve el backend', async () => {
    searchIncomes.mockResolvedValue(incomePageOf([SUELDO], { page: 2, totalElements: 8, totalPages: 2 }))

    renderPage('/activity?view=incomes&page=9')

    await waitFor(() => expect(location()).toHaveTextContent('page=2'))
  })

  it('ante un error permite reintentar sin afectar el balance', async () => {
    searchIncomes.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage('/activity?view=incomes')

    expect(await screen.findByText(SEARCH_INCOMES_ERROR_MESSAGE)).toBeInTheDocument()
    expect(within(screen.getByTestId('balance-card')).getByTestId('balance-net')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Sueldo octubre')).toBeInTheDocument()
    expect(searchIncomes).toHaveBeenCalledTimes(2)
  })

  it('una sesión vencida cierra la sesión', async () => {
    searchIncomes.mockResolvedValue({ ok: false, status: 401 })

    renderPage('/activity?view=incomes')

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})
