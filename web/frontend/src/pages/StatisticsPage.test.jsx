import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'

vi.mock('../api/statisticsClient', async (importOriginal) => ({
  ...(await importOriginal()),
  getStatisticsSummary: vi.fn(),
}))
const setUser = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

import { getStatisticsSummary, STATISTICS_ERROR_MESSAGE } from '../api/statisticsClient'
import { MONTH_NAMES } from '../validation/months'
import StatisticsPage from './StatisticsPage'

const NOW = new Date()
const YEAR = String(NOW.getFullYear())
const MONTH = String(NOW.getMonth() + 1)
const PERIOD = `${MONTH_NAMES[NOW.getMonth()].toLowerCase()} de ${YEAR}`

const EMPTY = { total: '0.00', categories: [] }
const INCOME = {
  total: '1000000.00',
  excludedCount: 0,
  categories: [
    { category: 'SALARY', amount: '800000.00', percentage: '80.0' },
    { category: 'FREELANCE', amount: '200000.00', percentage: '20.0' },
  ],
}

function statistics({ expenses = {}, income = {}, comparison = {}, ...overrides } = {}) {
  return {
    ok: true,
    statistics: {
      currency: 'ARS',
      expenses: {
        total: '160000.00',
        excludedCount: 0,
        personal: {
          total: '100000.00',
          categories: [
            { category: 'HOUSING', amount: '45000.00', percentage: '45.0' },
            { category: 'FOOD', amount: '35000.00', percentage: '35.0' },
            { category: 'TRANSPORT', amount: '20000.00', percentage: '20.0' },
          ],
        },
        group: {
          total: '60000.00',
          categories: [
            { category: 'FOOD', amount: '30000.00', percentage: '50.0' },
            { category: 'LEISURE', amount: '30000.00', percentage: '50.0' },
          ],
        },
        ...expenses,
      },
      income: { ...INCOME, ...income },
      comparison: {
        income: '1000000.00',
        expenses: '160000.00',
        balance: '840000.00',
        ...comparison,
      },
      years: [2024],
      ...overrides,
    },
  }
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderPage(entry = '/statistics') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/statistics"
          element={
            <>
              <StatisticsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const monthSelect = () => screen.getByRole('combobox', { name: 'Mes' })
const yearSelect = () => screen.getByRole('combobox', { name: 'Año' })
const location = () => screen.getByTestId('location')
const slicesOf = (name) =>
  within(screen.getByRole('group', { name: new RegExp(`^${name}:`) }))
    .getAllByRole('img')
    .map((slice) => slice.getAttribute('aria-label'))
const ready = () => screen.findByRole('heading', { name: /^Ingresos y gastos de/ })

beforeEach(() => {
  getStatisticsSummary.mockReset()
  setUser.mockReset()
  getStatisticsSummary.mockResolvedValue(statistics())
})

describe('StatisticsPage (032, 034)', () => {
  it('hace un único pedido y ordena selectores, barra comparativa y dos columnas', async () => {
    renderPage()

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    await ready()
    expect(getStatisticsSummary).toHaveBeenCalledTimes(1)
    expect(getStatisticsSummary).toHaveBeenCalledWith({ year: YEAR, month: MONTH })
    expect(monthSelect()).toHaveValue(MONTH)
    expect(yearSelect()).toHaveValue(YEAR)

    const income = screen.getByRole('heading', { name: 'Ingresos personales' })
    const expenses = screen.getByRole('heading', { name: 'Gastos personales' })
    const order = [
      monthSelect(),
      screen.getByRole('heading', { name: `Ingresos y gastos de ${PERIOD}` }),
      income,
      expenses,
    ]
    for (let index = 1; index < order.length; index += 1) {
      expect(
        order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    }
    const columns = document.querySelector('.statistics-columns')
    expect(columns.children).toHaveLength(2)
    expect(columns.children[0]).toContainElement(income)
    expect(columns.children[1]).toContainElement(expenses)
    expect(screen.getByText('Importes en Peso argentino (ARS)')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Gastos del período' })).not.toBeInTheDocument()
  })

  it('la columna de gastos empieza en personales y la pestaña Grupales muestra los grupales', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()

    expect(screen.getByRole('tab', { name: 'Personales' })).toHaveAttribute('aria-selected', 'true')
    expect(slicesOf('Gastos personales')).toEqual([
      'Vivienda · ARS 45.000,00 · 45,0 %',
      'Alimentos · ARS 35.000,00 · 35,0 %',
      'Transporte · ARS 20.000,00 · 20,0 %',
    ])
    await user.click(screen.getByRole('tab', { name: 'Grupales' }))

    expect(screen.getByRole('tab', { name: 'Grupales' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Grupales')
    expect(slicesOf('Gastos grupales')).toEqual([
      'Alimentos · ARS 30.000,00 · 50,0 %',
      'Ocio · ARS 30.000,00 · 50,0 %',
    ])
    expect(screen.queryByRole('group', { name: /^Gastos personales:/ })).not.toBeInTheDocument()
  })

  it('las flechas del teclado cambian de pestaña sin salirse de los extremos', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()

    screen.getByRole('tab', { name: 'Personales' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Personales' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Grupales' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Grupales' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Grupales' })).toHaveAttribute('aria-selected', 'true')
  })

  it('muestra el bloque de ingresos por categoría', async () => {
    renderPage()
    await ready()

    expect(slicesOf('Ingresos personales')).toEqual([
      'Sueldo · ARS 800.000,00 · 80,0 %',
      'Freelance · ARS 200.000,00 · 20,0 %',
    ])
    expect(screen.getByText('ARS 1.000.000,00', { selector: 'strong' })).toBeInTheDocument()
  })

  it('la barra comparativa muestra proporciones, montos y el balance con signo', async () => {
    const { container } = renderPage()
    await ready()

    expect(screen.getByRole('img', {
      name: 'Ingresos ARS 1.000.000,00 (86,2 %) y gastos ARS 160.000,00 (13,8 %)',
    })).toBeInTheDocument()
    const segments = [...container.querySelectorAll('.statistics-bar__segment')]
    expect(segments.map((segment) => segment.textContent)).toEqual(['86,2 %', '13,8 %'])
    expect(segments[0]).toHaveClass('statistics-bar__segment--income')
    expect(segments[1]).toHaveClass('statistics-bar__segment--expenses')
    expect(segments[0].style.width).toMatch(/^86\.2/)
    const figures = container.querySelector('.statistics-comparison__figures')
    expect(within(figures).getByText('ARS 1.000.000,00')).toBeInTheDocument()
    expect(within(figures).getByText('ARS 160.000,00')).toBeInTheDocument()
    expect(screen.getByText('Balance del período')).toBeInTheDocument()
    expect(screen.getByText('+ARS 840.000,00')).toBeInTheDocument()
    expect(container.querySelector('.statistics-comparison .pie-chart')).toBeNull()
    expect(container.querySelector('.statistics-comparison .statistics-legend')).toBeNull()
  })

  it('con un solo tipo con importe la barra tiene un único segmento', async () => {
    getStatisticsSummary.mockResolvedValue(
      statistics({ comparison: { expenses: '0.00', balance: '1000000.00' } }),
    )
    const { container } = renderPage()
    await ready()

    const segments = container.querySelectorAll('.statistics-bar__segment')
    expect(segments).toHaveLength(1)
    expect(segments[0].textContent).toBe('100,0 %')
  })

  it('las categorías y los porcentajes no se escriben ni debajo ni sobre las tortas', async () => {
    const { container } = renderPage()
    await ready()

    expect(container.querySelector('.statistics-legend')).toBeNull()
    expect(screen.queryByText('Sueldo')).not.toBeInTheDocument()
    expect(container.querySelector('.pie-chart__percentage')).toBeNull()
    expect(container.querySelector('.pie-chart text')).toBeNull()
  })

  it('la columna de ingresos dice Personales como la de gastos y el balance tiene el mismo tamaño que los totales', async () => {
    const { container } = renderPage()
    await ready()

    const columns = container.querySelector('.statistics-columns')
    expect(within(columns.children[0]).getByText('Personales')).toBeInTheDocument()
    expect(within(columns.children[1]).getByRole('tab', { name: 'Personales' })).toBeInTheDocument()
    const figures = container.querySelector('.statistics-comparison__figures')
    expect(figures.lastElementChild).toHaveClass('statistics-balance')
  })

  it('un balance negativo lleva signo y un texto que lo explica', async () => {
    getStatisticsSummary.mockResolvedValue(
      statistics({ income: { ...EMPTY, excludedCount: 0 }, comparison: { income: '0.00', balance: '-160000.00' } }),
    )
    renderPage()
    await ready()

    expect(screen.getByText('−ARS 160.000,00')).toBeInTheDocument()
    expect(screen.getByText('Los gastos superan a los ingresos')).toBeInTheDocument()
  })

  it('cada categoría tiene su color en la torta, con paleta propia para ingresos', async () => {
    const { container } = renderPage()
    await ready()

    const fills = [...container.querySelectorAll('.pie-chart path, .pie-chart circle')].map((shape) =>
      shape.getAttribute('fill'),
    )
    expect(fills).toEqual([
      'var(--color-ingreso-salary)',
      'var(--color-ingreso-freelance)',
      'var(--color-categoria-housing)',
      'var(--color-categoria-food)',
      'var(--color-categoria-transport)',
    ])
  })

  it('al pasar el cursor por una porción muestra categoría, monto y porcentaje', async () => {
    renderPage()
    await ready()

    fireEvent.mouseEnter(screen.getByRole('img', { name: /^Sueldo · ARS 800.000,00 · 80,0 %$/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^Sueldo · ARS 800.000,00 · 80,0 %$/)
    fireEvent.mouseLeave(screen.getByRole('img', { name: /^Sueldo/ }))
    fireEvent.click(screen.getByRole('img', { name: /^Vivienda/ }))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^Vivienda · ARS 45.000,00 · 45,0 %$/)
    expect(document.querySelector('.pie-chart figcaption')).toBeNull()
  })

  it('ofrece el año actual, los años del resumen y el de la dirección, de más reciente a más antiguo', async () => {
    renderPage('/statistics?year=2019&month=3')
    await ready()

    expect(getStatisticsSummary).toHaveBeenCalledWith({ year: '2019', month: '3' })
    const options = within(yearSelect()).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual([YEAR, '2024', '2019'])
    expect(within(monthSelect()).getAllByRole('option')).toHaveLength(13)
    expect(monthSelect()).toHaveValue('3')
  })

  it('cambiar el mes o el año consulta de inmediato, guarda el período en la dirección y conserva la pestaña', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()
    await user.click(screen.getByRole('tab', { name: 'Grupales' }))
    const otherMonth = MONTH === '10' ? '9' : '10'

    await user.selectOptions(monthSelect(), otherMonth)
    await waitFor(() =>
      expect(getStatisticsSummary).toHaveBeenLastCalledWith({ year: YEAR, month: otherMonth }))
    expect(location()).toHaveTextContent(new RegExp(`^/statistics\\?month=${otherMonth}$`))
    await ready()
    expect(screen.getByRole('tab', { name: 'Grupales' })).toHaveAttribute('aria-selected', 'true')

    await user.selectOptions(yearSelect(), '2024')
    await waitFor(() =>
      expect(getStatisticsSummary).toHaveBeenLastCalledWith({ year: '2024', month: otherMonth }))
    expect(location()).toHaveTextContent(new RegExp(`^/statistics\\?year=2024&month=${otherMonth}$`))

    await ready()
    await user.selectOptions(yearSelect(), YEAR)
    await user.selectOptions(monthSelect(), MONTH)
    await waitFor(() => expect(location()).toHaveTextContent(/^\/statistics$/))
  })

  it('ofrece "Todos los meses" y con él consulta y grafica el año entero', async () => {
    const user = userEvent.setup()
    renderPage()
    await ready()

    expect(within(monthSelect()).getAllByRole('option')[0]).toHaveTextContent('Todos los meses')
    await user.selectOptions(monthSelect(), '')

    await waitFor(() =>
      expect(getStatisticsSummary).toHaveBeenLastCalledWith({ year: YEAR, month: '' }))
    expect(location()).toHaveTextContent(/^\/statistics\?month=$/)
    expect(screen.getByRole('heading', { name: `Ingresos y gastos de todo el año ${YEAR}` }))
      .toBeInTheDocument()
    expect(slicesOf('Ingresos personales')).toHaveLength(2)

    await user.selectOptions(monthSelect(), MONTH)
    await waitFor(() => expect(location()).toHaveTextContent(/^\/statistics$/))
  })

  it('al llegar con month= en la dirección muestra todos los meses del año pedido', async () => {
    renderPage('/statistics?year=2024&month=')
    await ready()

    expect(getStatisticsSummary).toHaveBeenCalledWith({ year: '2024', month: '' })
    expect(monthSelect()).toHaveValue('')
    expect(screen.getByRole('heading', { name: 'Ingresos y gastos de todo el año 2024' }))
      .toBeInTheDocument()
  })

  it('un mes o un año inválido en la dirección se toma como el actual', async () => {
    renderPage('/statistics?year=20x5&month=13')
    await ready()

    expect(getStatisticsSummary).toHaveBeenCalledWith({ year: YEAR, month: MONTH })
  })

  it('solo muestra la respuesta del último período pedido', async () => {
    let resolveFirst
    getStatisticsSummary
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce(statistics({ comparison: { balance: '1.00' } }))
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(monthSelect(), MONTH === '10' ? '9' : '10')
    expect(await screen.findByText('+ARS 1,00')).toBeInTheDocument()
    resolveFirst(statistics({ comparison: { balance: '999.00' } }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(screen.queryByText('+ARS 999,00')).not.toBeInTheDocument()
  })

  it('sin gastos ni ingresos lo dice, ofrece registrarlos y no dibuja barra ni columnas', async () => {
    getStatisticsSummary.mockResolvedValue(
      statistics({
        expenses: { total: '0.00', personal: EMPTY, group: EMPTY },
        income: EMPTY,
        comparison: { income: '0.00', expenses: '0.00', balance: '0.00' },
      }),
    )

    renderPage()

    expect(await screen.findByText(`No registraste gastos ni ingresos en ${PERIOD}.`, { exact: false }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar un gasto' })).toHaveAttribute('href', '/expenses/new')
    expect(screen.getByRole('link', { name: 'Registrar un ingreso' })).toHaveAttribute('href', '/incomes/new')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('sin gastos pero con ingresos muestra el vacío en la columna de gastos y conserva el resto', async () => {
    getStatisticsSummary.mockResolvedValue(
      statistics({
        expenses: { total: '0.00', personal: EMPTY, group: EMPTY },
        comparison: { expenses: '0.00', balance: '1000000.00' },
      }),
    )

    renderPage()

    expect(await screen.findByText(`No registraste gastos en ${PERIOD}.`, { exact: false }))
      .toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(slicesOf('Ingresos personales')).toHaveLength(2)
  })

  it('sin ingresos efectivizados lo dice en su bloque y ofrece registrar uno', async () => {
    getStatisticsSummary.mockResolvedValue(
      statistics({ income: EMPTY, comparison: { income: '0.00', balance: '-160000.00' } }),
    )

    renderPage()

    expect(await screen.findByText(`No registraste ingresos efectivizados en ${PERIOD}.`, { exact: false }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar un ingreso' })).toHaveAttribute('href', '/incomes/new')
    expect(screen.getByRole('tablist', { name: 'Tipo de gasto' })).toBeInTheDocument()
  })

  it('con un solo tipo de gasto muestra el mensaje del otro en su pestaña', async () => {
    getStatisticsSummary.mockResolvedValueOnce(statistics({ expenses: { group: EMPTY } }))
    const { unmount } = renderPage()

    await ready()
    expect(slicesOf('Gastos personales')).toHaveLength(3)
    await userEvent.click(screen.getByRole('tab', { name: 'Grupales' }))
    expect(screen.getByText(`No tuviste gastos grupales en ${PERIOD}.`)).toBeInTheDocument()
    unmount()

    getStatisticsSummary.mockResolvedValueOnce(statistics({ expenses: { personal: EMPTY } }))
    renderPage()
    expect(await screen.findByText(`No registraste gastos personales en ${PERIOD}.`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Grupales' }))
    expect(slicesOf('Gastos grupales')).toHaveLength(2)
  })

  it('avisa por separado los gastos y los ingresos que no se pudieron convertir', async () => {
    getStatisticsSummary.mockResolvedValueOnce(
      statistics({ expenses: { excludedCount: 1 }, income: { excludedCount: 1 } }),
    )
    const { unmount } = renderPage()
    expect(await screen.findByText('1 gasto no se pudo convertir a ARS y no está incluido.'))
      .toBeInTheDocument()
    expect(screen.getByText('1 ingreso no se pudo convertir a ARS y no está incluido.'))
      .toBeInTheDocument()
    unmount()

    getStatisticsSummary.mockResolvedValueOnce(
      statistics({ currency: 'USD', expenses: { excludedCount: 3 }, income: { excludedCount: 2 } }),
    )
    renderPage()
    expect(await screen.findByText('3 gastos no se pudieron convertir a USD y no están incluidos.'))
      .toBeInTheDocument()
    expect(screen.getByText('2 ingresos no se pudieron convertir a USD y no están incluidos.'))
      .toBeInTheDocument()
  })

  it('ante un error no muestra bloques parciales y permite reintentar', async () => {
    getStatisticsSummary.mockResolvedValueOnce({ ok: false, network: true })
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(STATISTICS_ERROR_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ingresos personales' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    await ready()
    expect(getStatisticsSummary).toHaveBeenCalledTimes(2)
  })

  it('una sesión vencida cierra la sesión', async () => {
    getStatisticsSummary.mockResolvedValue({ ok: false, status: 401 })

    renderPage()

    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})
