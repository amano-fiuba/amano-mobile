import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DebtPaymentSummary from './DebtPaymentSummary'
import PaymentOutcomePreview, { OUTCOME_EMPTY_MESSAGE, OUTCOME_LABEL } from './PaymentOutcomePreview'

// 018 T044: pieces of the "Registrar pago" screen (plan.md §Componentes).

const DEBT = {
  id: 31,
  debtor: { type: 'REGISTERED', userId: 15, name: 'Juan Pérez' },
  creditor: { userId: 7, name: 'Ana López' },
  amount: '3333.33',
  paidAmount: '1000.00',
  outstanding: '2333.33',
  currency: 'ARS',
  status: 'PARTIALLY_PAID',
  canRegisterPayment: true,
}

describe('DebtPaymentSummary (018)', () => {
  it('muestra quién le paga a quién, los tres montos y el estado actual', () => {
    render(<DebtPaymentSummary debt={DEBT} />)
    const summary = screen.getByTestId('debt-payment-summary')
    expect(screen.getByRole('heading', { name: 'Juan Pérez le paga a Ana López' })).toBeInTheDocument()
    expect(summary).toHaveTextContent('Total$ 3.333,33')
    expect(summary).toHaveTextContent('Pagado$ 1.000,00')
    expect(summary).toHaveTextContent('Saldo$ 2.333,33')
    expect(screen.getByTestId('debt-status')).toHaveTextContent('Pago parcial · faltan $ 2.333,33')
  })

  it('tolera nombres ausentes', () => {
    render(<DebtPaymentSummary debt={{ ...DEBT, debtor: null, creditor: undefined }} />)
    expect(screen.getByRole('heading', { name: 'Alguien le paga a alguien' })).toBeInTheDocument()
  })
})

describe('PaymentOutcomePreview (018)', () => {
  it('un parcial muestra el saldo que queda', () => {
    render(<PaymentOutcomePreview debt={DEBT} amount="333.33" />)
    const preview = screen.getByTestId('payment-outcome')
    expect(preview).toHaveTextContent(OUTCOME_LABEL)
    expect(screen.getByTestId('debt-status')).toHaveTextContent('Pago parcial · faltan $ 2.000,00')
    expect(preview).toHaveAttribute('aria-live', 'polite')
  })

  it('el saldo completo muestra "Pagada"', () => {
    render(<PaymentOutcomePreview debt={DEBT} amount="2333.33" />)
    expect(screen.getByTestId('debt-status')).toHaveTextContent('Pagada')
  })

  it('sin un monto válido muestra la ayuda', () => {
    const { rerender } = render(<PaymentOutcomePreview debt={DEBT} amount={null} />)
    expect(screen.getByText(OUTCOME_EMPTY_MESSAGE)).toBeInTheDocument()
    rerender(<PaymentOutcomePreview debt={DEBT} amount="9999.00" />)
    expect(screen.getByText(OUTCOME_EMPTY_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByTestId('debt-status')).not.toBeInTheDocument()
  })
})
