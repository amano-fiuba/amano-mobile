import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/incomeClient', async (importOriginal) => ({
  ...await importOriginal(),
  getBalance: vi.fn(),
}))

import { BALANCE_ERROR_MESSAGE, getBalance } from '../api/incomeClient'
import BalanceCard from './BalanceCard'

const BALANCE = {
  currency: 'ARS',
  income: '1234.50',
  projectedIncome: '0.00',
  expenses: '400.00',
  net: '834.50',
}

beforeEach(() => {
  getBalance.mockReset()
})

describe('BalanceCard (033)', () => {
  it('mientras carga muestra la estructura con marcadores y está ocupada', async () => {
    getBalance.mockReturnValue(new Promise(() => {}))

    render(<BalanceCard year="2026" />)

    const card = screen.getByTestId('balance-card')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(within(card).getByText('Ingresos')).toBeInTheDocument()
    expect(within(card).getByText('Balance neto')).toBeInTheDocument()
    expect(within(card).getAllByText('…')).toHaveLength(3)
  })

  it('muestra ingresos, gastos y el neto con signo explícito y la moneda principal', async () => {
    getBalance.mockResolvedValue({ ok: true, balance: BALANCE })

    render(<BalanceCard year="2026" month="3" />)

    const income = await screen.findByText('1.234,50 ARS')
    expect(income).toBeInTheDocument()
    expect(income).toHaveClass('balance-card__income')
    const expenses = screen.getByText('400,00 ARS')
    expect(expenses).toHaveClass('balance-card__expenses')
    const net = screen.getByTestId('balance-net')
    expect(net).toHaveTextContent('+834,50 ARS')
    expect(net).toHaveClass('balance-card__net--positive')
    expect(net).not.toHaveClass('balance-card__net--negative')
    expect(getBalance).toHaveBeenCalledWith({ year: '2026', month: '3' })
    expect(screen.getByTestId('balance-card')).toHaveAttribute('aria-busy', 'false')
  })

  it('un neto negativo lleva signo menos, otro ícono, texto y la clase de alerta', async () => {
    getBalance.mockResolvedValue({
      ok: true,
      balance: { ...BALANCE, income: '100.00', expenses: '350.50', net: '-250.50' },
    })

    render(<BalanceCard />)

    const net = await screen.findByTestId('balance-net')
    await waitFor(() => expect(net).toHaveTextContent('−250,50 ARS'))
    expect(net).toHaveClass('balance-card__net--negative')
    expect(net).not.toHaveClass('balance-card__net--positive')
    expect(net).toHaveTextContent('▼')
    expect(net).toHaveTextContent('a favor de los gastos')
    expect(getBalance).toHaveBeenCalledWith({ year: undefined, month: undefined })
  })

  it('muestra la línea "Proyectado" solo cuando hay ingresos futuros', async () => {
    getBalance.mockResolvedValue({ ok: true, balance: { ...BALANCE, projectedIncome: '500.00' } })
    const { unmount } = render(<BalanceCard />)
    expect(await screen.findByText(/Proyectado: \+500,00 ARS/)).toBeInTheDocument()
    unmount()

    getBalance.mockResolvedValue({ ok: true, balance: BALANCE })
    render(<BalanceCard />)
    await screen.findByText('1.234,50 ARS')
    expect(screen.queryByText(/Proyectado/)).not.toBeInTheDocument()
  })

  it('sin cotización para lo proyectado (campo ausente) no muestra la línea ni falla', async () => {
    const withoutProjected = { ...BALANCE }
    delete withoutProjected.projectedIncome
    getBalance.mockResolvedValue({ ok: true, balance: withoutProjected })

    render(<BalanceCard />)

    expect(await screen.findByText('1.234,50 ARS')).toBeInTheDocument()
    expect(screen.queryByText(/Proyectado/)).not.toBeInTheDocument()
  })

  it('ante un error muestra el mensaje y "Reintentar" vuelve a pedir el balance', async () => {
    getBalance
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, balance: BALANCE })
    const user = userEvent.setup()
    render(<BalanceCard year="2026" />)

    expect(await screen.findByText(BALANCE_ERROR_MESSAGE)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('1.234,50 ARS')).toBeInTheDocument()
    expect(getBalance).toHaveBeenCalledTimes(2)
  })

  it('vuelve a pedir el balance cuando cambian el año, el mes o refreshKey, sin caché', async () => {
    getBalance
      .mockResolvedValueOnce({ ok: true, balance: BALANCE })
      .mockResolvedValue({ ok: true, balance: { ...BALANCE, income: '2000.00', net: '1600.00' } })
    const { rerender } = render(<BalanceCard year="2026" refreshKey={1} />)
    expect(await screen.findByText('1.234,50 ARS')).toBeInTheDocument()

    rerender(<BalanceCard year="2026" refreshKey={2} />)

    expect(await screen.findByText('2.000,00 ARS')).toBeInTheDocument()
    expect(screen.queryByText('1.234,50 ARS')).not.toBeInTheDocument()
    rerender(<BalanceCard year="2025" refreshKey={2} />)
    await waitFor(() => expect(getBalance).toHaveBeenCalledTimes(3))
    rerender(<BalanceCard year="2025" month="4" refreshKey={2} />)
    await waitFor(() => expect(getBalance).toHaveBeenCalledTimes(4))
  })

  it('una respuesta vieja que llega tarde no pisa a la más nueva', async () => {
    let resolveOld
    getBalance
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce({ ok: true, balance: { ...BALANCE, income: '7.00', net: '3.00' } })
    const { rerender } = render(<BalanceCard year="2025" />)
    rerender(<BalanceCard year="2026" />)
    expect(await screen.findByText('7,00 ARS')).toBeInTheDocument()

    resolveOld({ ok: true, balance: BALANCE })

    await waitFor(() => expect(screen.queryByText('1.234,50 ARS')).not.toBeInTheDocument())
    expect(screen.getByText('7,00 ARS')).toBeInTheDocument()
  })
})
