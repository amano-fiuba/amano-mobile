import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/incomeClient', () => ({
  BALANCE_ERROR_MESSAGE: 'No se pudo obtener el balance',
  getBalance: vi.fn(),
}))

import { getBalance } from '../../api/incomeClient'
import MonthlyBalanceSummaryCard from './MonthlyBalanceSummaryCard'

const BALANCE = {
  currency: 'ARS',
  income: '150000.50',
  expenses: '40000.00',
  net: '110000.50',
  projectedIncome: '0.00',
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-18T15:00:00Z'))
  getBalance.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('MonthlyBalanceSummaryCard', () => {
  it('pide el mes en curso y muestra título e ingresos, egresos y balance con sus colores', async () => {
    getBalance.mockResolvedValue({ ok: true, balance: BALANCE })

    render(<MonthlyBalanceSummaryCard />)

    expect(await screen.findByRole('heading', { name: 'Balance de Noviembre' })).toBeInTheDocument()
    expect(getBalance).toHaveBeenCalledWith({ year: 2026, month: 11 })
    await waitFor(() => expect(screen.getByTestId('monthly-income')).toHaveTextContent('+150.000,50 ARS'))
    expect(screen.getByTestId('monthly-income')).toHaveClass('monthly-balance__income')
    expect(screen.getByTestId('monthly-expenses')).toHaveTextContent('-40.000,00 ARS')
    expect(screen.getByTestId('monthly-expenses')).toHaveClass('monthly-balance__expenses')
    expect(screen.getByTestId('monthly-net')).toHaveTextContent('+110.000,50 ARS')
    expect(screen.getByTestId('monthly-net').parentElement).not.toHaveClass(
      'monthly-balance__net--negative',
    )
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Ingresos',
      'Egresos',
      'Balance',
    ])
  })

  it('un balance negativo se marca con signo menos y el estilo de error', async () => {
    getBalance.mockResolvedValue({
      ok: true,
      balance: { ...BALANCE, income: '100.00', expenses: '350.00', net: '-250.00' },
    })

    render(<MonthlyBalanceSummaryCard />)

    await waitFor(() => expect(screen.getByTestId('monthly-net')).toHaveTextContent('−250,00 ARS'))
    expect(screen.getByTestId('monthly-net').parentElement).toHaveClass(
      'monthly-balance__net--negative',
    )
  })

  it('mientras carga muestra un esqueleto ocupado', () => {
    getBalance.mockReturnValue(new Promise(() => {}))

    render(<MonthlyBalanceSummaryCard />)

    expect(screen.getByRole('region', { name: 'Balance de Noviembre' })).toHaveAttribute(
      'aria-busy',
      'true',
    )
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('ante un error muestra el mensaje y "Reintentar" vuelve a pedir el balance', async () => {
    getBalance
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValue({ ok: true, balance: BALANCE })
    render(<MonthlyBalanceSummaryCard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo obtener el balance')
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      screen.getByRole('button', { name: 'Reintentar' }),
    )

    await waitFor(() => expect(screen.getByTestId('monthly-net')).toHaveTextContent('+110.000,50 ARS'))
    expect(getBalance).toHaveBeenCalledTimes(2)
  })
})
