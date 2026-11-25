import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CurrencySelector from './CurrencySelector'

const { listCurrencies } = vi.hoisted(() => ({ listCurrencies: vi.fn() }))
vi.mock('../api/currencyClient', () => ({ listCurrencies }))

// US3 currency contract (task T035, written BEFORE the component):
// multi-select of ARS/USD/EUR; an empty selection persists nothing and the
// client shows the ARS default (Q1/FR-011). Optional: never blocks the rest.
afterEach(() => {
  vi.restoreAllMocks()
})

function renderSelector() {
  const onChange = vi.fn()
  render(<CurrencySelector onChange={onChange} />)
  return onChange
}

describe('CurrencySelector (T035)', () => {
  it('la legend no lleva "(opcional" y mantiene el default ARS (T044, FR-023)', () => {
    renderSelector()

    expect(screen.getByText(/monedas \(default ARS\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/opcional/i)).not.toBeInTheDocument()
  })

  it('arranca sin selección y sin error (opcional, Q1)', () => {
    renderSelector()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('permite multiselección ARS/USD/EUR y entrega los códigos (Q1/FR-011)', async () => {
    const onChange = renderSelector()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/USD/i))
    await user.click(screen.getByLabelText(/EUR/i))
    await user.click(screen.getByLabelText(/ARS/i))

    expect(onChange).toHaveBeenLastCalledWith(['USD', 'EUR', 'ARS'])
  })

  it('selección única entrega una sola moneda', async () => {
    const onChange = renderSelector()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/ARS/i))

    expect(onChange).toHaveBeenLastCalledWith(['ARS'])
  })

  it('deseleccionar todo vuelve a vacío → el form no se bloquea (Q1/FR-003)', async () => {
    const onChange = renderSelector()
    const user = userEvent.setup()

    const ars = screen.getByLabelText(/ARS/i)
    await user.click(ars)
    await user.click(ars)

    expect(onChange).toHaveBeenLastCalledWith([])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('CurrencySelector: "Ver más…" (027, FR-014)', () => {
  it('agrega una moneda del catálogo del BCRA a la selección', async () => {
    listCurrencies.mockResolvedValue({ ok: true, currencies: [{ code: 'BRL', bcraName: 'REAL' }] })
    const onChange = renderSelector()
    const user = userEvent.setup()

    await user.click(screen.getByLabelText(/ARS/i))
    await user.click(screen.getByRole('button', { name: 'Ver más…' }))
    await user.click(await screen.findByLabelText('Real brasileño (BRL)'))
    await user.click(screen.getByRole('button', { name: 'Elegir' }))

    expect(onChange).toHaveBeenLastCalledWith(['ARS', 'BRL'])
    expect(screen.getByRole('checkbox', { name: 'Real brasileño (BRL)' })).toBeChecked()

    // Destildada, sigue en la lista para volver a elegirla.
    await user.click(screen.getByRole('checkbox', { name: 'Real brasileño (BRL)' }))
    expect(onChange).toHaveBeenLastCalledWith(['ARS'])
    expect(screen.getByRole('checkbox', { name: 'Real brasileño (BRL)' })).not.toBeChecked()

    // Elegirla otra vez desde el catálogo no la duplica.
    await user.click(screen.getByRole('button', { name: 'Ver más…' }))
    const dialog = screen.getByRole('dialog')
    await user.click(await within(dialog).findByLabelText('Real brasileño (BRL)'))
    await user.click(within(dialog).getByRole('button', { name: 'Elegir' }))
    expect(onChange).toHaveBeenLastCalledWith(['ARS', 'BRL'])
    expect(screen.getAllByRole('checkbox', { name: 'Real brasileño (BRL)' })).toHaveLength(1)
  })

  it('cancelar el catálogo no cambia la selección', async () => {
    listCurrencies.mockResolvedValue({ ok: true, currencies: [] })
    const onChange = renderSelector()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ver más…' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('controlado: muestra la selección recibida (incluidas monedas extra) y no guarda estado propio', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CurrencySelector value={['USD', 'CLP']} onChange={onChange} legend="Monedas preferidas" />)

    expect(screen.getByText('Monedas preferidas')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Peso chileno (CLP)' })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'Peso chileno (CLP)' }))
    expect(onChange).toHaveBeenLastCalledWith(['USD'])
    // El valor lo maneja el padre: sin actualizarlo, sigue tildada.
    expect(screen.getByRole('checkbox', { name: 'Peso chileno (CLP)' })).toBeChecked()
  })
})
