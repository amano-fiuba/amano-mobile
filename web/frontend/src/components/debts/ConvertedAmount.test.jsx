import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConvertedAmount from './ConvertedAmount'

// 022 T010: the original amount is always shown; the converted amount appears
// only when the currencies differ and the backend sent a quote.
describe('ConvertedAmount (022)', () => {
  it('muestra el monto original y el convertido cuando la moneda difiere', () => {
    render(
      <ConvertedAmount
        amount="50.00"
        currency="USD"
        convertedAmount="925.00"
        convertedCurrency="ARS"
      />,
    )

    expect(screen.getByTestId('converted-amount')).toHaveTextContent(
      '$ 50,00 USD · $ 925,00 ARS',
    )
  })

  it('muestra solo el monto original cuando la moneda es la misma', () => {
    render(
      <ConvertedAmount
        amount="925.00"
        currency="ARS"
        convertedAmount="925.00"
        convertedCurrency="ARS"
      />,
    )

    expect(screen.getByTestId('converted-amount')).toHaveTextContent('$ 925,00 ARS')
    expect(screen.getByTestId('converted-amount')).not.toHaveTextContent('·')
  })

  it('no inventa una conversión si no hay cotización', () => {
    render(<ConvertedAmount amount="50.00" currency="USD" />)

    expect(screen.getByTestId('converted-amount')).toHaveTextContent('$ 50,00 USD')
    expect(screen.getByTestId('converted-amount')).not.toHaveTextContent('·')
  })
})
