import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CurrencySelect from './CurrencySelect'

const { listCurrencies } = vi.hoisted(() => ({ listCurrencies: vi.fn() }))
vi.mock('../api/currencyClient', () => ({ listCurrencies }))

function Harness({ preferred, initial = 'ARS', onChange = () => {} }) {
  const [value, setValue] = useState(initial)
  return (
    <CurrencySelect
      preferred={preferred}
      value={value}
      onChange={(code) => {
        setValue(code)
        onChange(code)
      }}
    />
  )
}

function optionTexts() {
  return within(screen.getByLabelText('Moneda'))
    .getAllByRole('option', { hidden: true })
    .map((option) => option.textContent)
}

beforeEach(() => {
  listCurrencies.mockResolvedValue({
    ok: true,
    currencies: [
      { code: 'ARS', bcraName: 'PESO' },
      { code: 'BRL', bcraName: 'REAL' },
    ],
  })
})

describe('CurrencySelect (027, FR-011 a FR-013)', () => {
  it('lista las preferidas, después "Ver más…"', () => {
    render(<Harness preferred={['USD', 'ARS']} initial="USD" />)

    expect(optionTexts()).toEqual(['Dólar estadounidense', 'Peso argentino', 'Ver más…'])
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
  })

  it('sin preferidas muestra ARS', () => {
    render(<Harness preferred={[]} />)

    expect(optionTexts()[0]).toBe('Peso argentino')
  })

  it('suma la moneda actual si no es preferida e ignora códigos no soportados', () => {
    render(<Harness preferred={['ARS', 'XAU']} initial="GBP" />)

    expect(optionTexts()).toEqual(['Peso argentino', 'Libra esterlina', 'Ver más…'])
  })

  it('cambiar entre las propias llama a onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness preferred={['ARS', 'USD']} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD')

    expect(onChange).toHaveBeenCalledWith('USD')
  })

  it('"Ver más…" abre el catálogo sin cambiar el valor; elegir agrega la moneda y la selecciona', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness preferred={['ARS']} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Moneda'), 'Ver más…')

    expect(screen.getByRole('dialog', { name: 'Elegir otra moneda' })).toBeInTheDocument()
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
    expect(onChange).not.toHaveBeenCalled()

    await user.click(await screen.findByLabelText('Real brasileño (BRL)'))
    await user.click(screen.getByRole('button', { name: 'Elegir' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith('BRL')
    expect(screen.getByLabelText('Moneda')).toHaveValue('BRL')
    expect(optionTexts()).toEqual(['Peso argentino', 'Real brasileño', 'Ver más…'])

    // Volver a ARS mantiene a BRL como opción elegida antes.
    await user.selectOptions(screen.getByLabelText('Moneda'), 'ARS')
    expect(optionTexts()).toContain('Real brasileño')
  })

  it('cancelar el catálogo mantiene la moneda anterior', async () => {
    const user = userEvent.setup()
    render(<Harness preferred={['ARS', 'USD']} initial="USD" />)

    await user.selectOptions(screen.getByLabelText('Moneda'), 'Ver más…')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
  })

  it('muestra el error recibido', () => {
    render(<CurrencySelect preferred={['ARS']} value="ARS" error="La moneda es obligatoria" />)

    expect(screen.getByRole('alert')).toHaveTextContent('La moneda es obligatoria')
    expect(screen.getByLabelText('Moneda')).toHaveAttribute('aria-invalid', 'true')
  })
})
