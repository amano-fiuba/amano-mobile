import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CurrencyCatalogDialog, { CATALOG_EMPTY_MESSAGE, CATALOG_ERROR_MESSAGE } from './CurrencyCatalogDialog'

const { listCurrencies } = vi.hoisted(() => ({ listCurrencies: vi.fn() }))
vi.mock('../api/currencyClient', () => ({ listCurrencies }))

const CATALOG = [
  { code: 'ARS', bcraName: 'PESO' },
  { code: 'BRL', bcraName: 'REAL' },
  { code: 'USD', bcraName: 'DOLAR E.E.U.U.' },
  { code: 'XYZ', bcraName: 'MONEDA NUEVA' },
]

function renderDialog(props = {}) {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(<CurrencyCatalogDialog onSelect={onSelect} onClose={onClose} {...props} />)
  return { onSelect, onClose }
}

beforeEach(() => {
  listCurrencies.mockReset()
  listCurrencies.mockResolvedValue({ ok: true, currencies: CATALOG })
})

describe('CurrencyCatalogDialog (027, FR-012)', () => {
  it('muestra Cargando y después las monedas con su etiqueta en español o la del BCRA', async () => {
    renderDialog()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando monedas…')
    expect(await screen.findByLabelText('Real brasileño (BRL)')).toBeInTheDocument()
    expect(screen.getByLabelText('Dólar estadounidense (USD)')).toBeInTheDocument()
    // Sin etiqueta propia: se usa la denominación del BCRA.
    expect(screen.getByLabelText('MONEDA NUEVA (XYZ)')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Elegir otra moneda' })).toBeInTheDocument()
  })

  it('el buscador filtra por código o nombre, sin acentos', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByLabelText('Real brasileño (BRL)')
    const search = screen.getByLabelText('Buscar por código o nombre')
    expect(search).toHaveFocus()

    await user.type(search, 'real')
    expect(screen.getAllByRole('radio')).toHaveLength(1)

    await user.clear(search)
    await user.type(search, 'dolar')
    expect(screen.getByLabelText('Dólar estadounidense (USD)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Real brasileño (BRL)')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'brl')
    expect(screen.getByLabelText('Real brasileño (BRL)')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText(CATALOG_EMPTY_MESSAGE)).toBeInTheDocument()
  })

  it('"Elegir" queda deshabilitado hasta elegir y entrega el código', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderDialog()
    await screen.findByLabelText('Real brasileño (BRL)')

    expect(screen.getByRole('button', { name: 'Elegir' })).toBeDisabled()
    await user.click(screen.getByLabelText('Real brasileño (BRL)'))
    await user.click(screen.getByRole('button', { name: 'Elegir' }))

    expect(onSelect).toHaveBeenCalledWith('BRL')
  })

  it('arranca con la moneda actual marcada', async () => {
    renderDialog({ initialCode: 'USD' })

    expect(await screen.findByLabelText('Dólar estadounidense (USD)')).toBeChecked()
    expect(screen.getByRole('button', { name: 'Elegir' })).toBeEnabled()
  })

  it('si el BCRA no responde muestra el error y "Reintentar" vuelve a pedir', async () => {
    listCurrencies.mockResolvedValueOnce({ ok: false, unavailable: true })
    const user = userEvent.setup()
    renderDialog()

    expect(await screen.findByRole('alert')).toHaveTextContent(CATALOG_ERROR_MESSAGE)
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Real brasileño (BRL)')).toBeInTheDocument()
    expect(listCurrencies).toHaveBeenCalledTimes(2)
  })

  it('"Cancelar" y Escape cierran sin elegir', async () => {
    const user = userEvent.setup()
    const { onSelect, onClose } = renderDialog()
    await screen.findByLabelText('Real brasileño (BRL)')

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('al desmontarse durante la carga no actualiza el estado', async () => {
    let resolve
    listCurrencies.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const { unmount } = render(<CurrencyCatalogDialog onSelect={vi.fn()} onClose={vi.fn()} />)

    unmount()
    resolve({ ok: true, currencies: CATALOG })
    await waitFor(() => expect(listCurrencies).toHaveBeenCalledTimes(1))
  })
})
