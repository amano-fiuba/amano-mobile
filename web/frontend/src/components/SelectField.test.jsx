import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SelectField from './SelectField'

const OPTIONS = [
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'USD', label: 'Dólar estadounidense' },
]

describe('SelectField (T025)', () => {
  it('asocia la etiqueta, muestra el placeholder y las opciones del catálogo', () => {
    render(<SelectField label="Moneda" options={OPTIONS} />)

    const select = screen.getByLabelText('Moneda')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Seleccioná una opción' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Peso argentino' })).toHaveValue('ARS')
    expect(screen.getByRole('option', { name: 'Dólar estadounidense' })).toHaveValue('USD')
    expect(select).not.toHaveAttribute('aria-invalid')
  })

  it('con placeholder={null} no ofrece la opción vacía', () => {
    render(<SelectField label="Moneda" options={OPTIONS} placeholder={null} defaultValue="ARS" />)

    expect(screen.queryByRole('option', { name: 'Seleccioná una opción' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.getByLabelText('Moneda')).toHaveValue('ARS')
  })

  it('expone el error con aria-invalid, aria-describedby y role=alert', () => {
    render(<SelectField label="Categoría" options={OPTIONS} error="La categoría es obligatoria" />)

    const select = screen.getByLabelText('Categoría')
    const error = screen.getByRole('alert')

    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAttribute('aria-describedby', error.id)
    expect(error).toHaveTextContent('La categoría es obligatoria')
  })

  it('propaga el cambio de selección', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SelectField label="Moneda" options={OPTIONS} onChange={onChange} />)

    await user.selectOptions(screen.getByLabelText('Moneda'), 'USD')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Moneda')).toHaveValue('USD')
  })
})
