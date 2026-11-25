import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PieChart from './PieChart'

const ITEMS = [
  { key: 'HOUSING', label: 'Vivienda', color: 'red', value: 50, detail: 'Vivienda · ARS 50,00 · 50,0 %' },
  { key: 'FOOD', label: 'Alimentos', color: 'blue', value: 30, detail: 'Alimentos · ARS 30,00 · 30,0 %' },
  { key: 'PETS', label: 'Mascotas', color: 'green', value: 20, detail: 'Mascotas · ARS 20,00 · 20,0 %' },
]

function renderChart(items = ITEMS) {
  return render(<PieChart items={items} label="Personales" />)
}

const slice = (name) => screen.getByRole('img', { name })

describe('PieChart (032)', () => {
  it('dibuja una porción por categoría con su color dentro de un grupo rotulado', () => {
    const { container } = renderChart()

    expect(screen.getByRole('group', { name: 'Personales' })).toBeInTheDocument()
    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(3)
    expect([...paths].map((path) => path.getAttribute('fill'))).toEqual(['red', 'blue', 'green'])
    expect(slice(ITEMS[0].detail)).toHaveAttribute('tabindex', '0')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.queryByText(/Pasá el cursor/)).not.toBeInTheDocument()
  })

  it('empieza arriba y la primera porción de la mitad termina abajo', () => {
    const { container } = renderChart()

    // 50 % from the top (100, 8) clockwise to the bottom (100, 192), small arc.
    expect(container.querySelector('path').getAttribute('d')).toBe(
      'M 100 100 L 100 8 A 92 92 0 0 1 100 192 Z',
    )
  })

  it('usa el arco largo para una porción de más de la mitad', () => {
    const { container } = renderChart([
      { ...ITEMS[0], value: 75 },
      { ...ITEMS[1], value: 25 },
    ])

    expect(container.querySelector('path').getAttribute('d')).toContain(' 0 1 1 ')
  })

  it('con una sola categoría dibuja un círculo completo', () => {
    const { container } = renderChart([ITEMS[0]])

    expect(container.querySelector('path')).toBeNull()
    expect(container.querySelector('circle')).toHaveAttribute('fill', 'red')
    expect(slice(ITEMS[0].detail)).toBeInTheDocument()
  })

  it('omite las porciones sin valor', () => {
    const { container } = renderChart([ITEMS[0], { ...ITEMS[1], value: 0 }])

    expect(container.querySelectorAll('path')).toHaveLength(1)
  })

  it('muestra el tooltip con nombre e importe al pasar el mouse y lo quita al salir', () => {
    renderChart()

    fireEvent.mouseEnter(slice(ITEMS[1].detail))
    expect(screen.getByRole('tooltip')).toHaveTextContent(/^Alimentos · ARS 30,00 · 30,0 %$/)
    expect(slice(ITEMS[1].detail)).toHaveClass('is-active')

    fireEvent.mouseLeave(slice(ITEMS[1].detail))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('muestra el tooltip al enfocar con el teclado o tocar una porción', async () => {
    const user = userEvent.setup()
    renderChart()

    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Vivienda · ARS 50,00 · 50,0 %')
    await user.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Alimentos · ARS 30,00 · 30,0 %')
    await user.tab()
    await user.tab()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(slice(ITEMS[1].detail))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Alimentos · ARS 30,00 · 30,0 %')
  })

  it('un ítem con tooltip propio lo muestra en lugar del detalle', () => {
    renderChart()

    renderChart([{ ...ITEMS[2], tooltip: 'Mascotas · ARS 20,00' }])
    fireEvent.mouseEnter(screen.getAllByRole('img', { name: ITEMS[2].detail }).at(-1))

    expect(screen.getByRole('tooltip')).toHaveTextContent(/^Mascotas · ARS 20,00$/)
  })

  it('no escribe texto de ayuda ni leyenda debajo del gráfico', () => {
    const { container } = renderChart()

    expect(container.querySelector('figcaption')).toBeNull()
    expect(container.querySelector('ul')).toBeNull()
  })

  it('el tooltip de un círculo completo queda sobre el centro', () => {
    renderChart([ITEMS[0]])

    fireEvent.mouseEnter(slice(ITEMS[0].detail))

    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '50%', top: '50%' })
  })
})

describe('PieChart con dos porciones (034)', () => {
  const INCOME = {
    key: 'income',
    label: 'Ingresos',
    color: 'teal',
    value: 750,
    detail: 'Ingresos · ARS 750,00 · 75,0 %',
  }
  const EXPENSES = {
    key: 'expenses',
    label: 'Gastos',
    color: 'orange',
    value: 250,
    detail: 'Gastos · ARS 250,00 · 25,0 %',
  }

  it('dibuja dos porciones proporcionales con su detalle accesible', () => {
    const { container } = render(<PieChart items={[INCOME, EXPENSES]} label="Ingresos contra gastos" />)

    expect(container.querySelectorAll('path')).toHaveLength(2)
    expect(container.querySelector('path').getAttribute('d')).toContain(' 0 1 1 ')
    expect(screen.getByRole('img', { name: INCOME.detail })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: EXPENSES.detail })).toBeInTheDocument()
  })

  it('con un solo importe es un círculo completo', () => {
    const { container } = render(<PieChart items={[EXPENSES]} label="Ingresos contra gastos" />)

    expect(container.querySelector('path')).toBeNull()
    expect(container.querySelector('circle')).toHaveAttribute('fill', 'orange')
  })

  it('muestra el detalle de la porción enfocada', async () => {
    const user = userEvent.setup()
    render(<PieChart items={[INCOME, EXPENSES]} label="Ingresos contra gastos" />)

    await user.tab()

    expect(screen.getByRole('tooltip')).toHaveTextContent(INCOME.detail)
  })
})
