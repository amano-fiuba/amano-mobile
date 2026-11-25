import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupExpensesClient', async (importOriginal) => ({
  ...await importOriginal(),
  whistleDebt: vi.fn(),
}))
const setUser = vi.fn()
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7 }, setUser }),
}))
const showSnackbar = vi.fn()
vi.mock('../Snackbar', () => ({ useSnackbar: () => showSnackbar }))

import { whistleDebt } from '../../api/groupExpensesClient'
import WhistleButton, {
  SIMULATED_NOTE,
  WHISTLE_DELIVERY_ERROR,
  WHISTLE_LIMIT_NOTE,
  WHISTLE_NETWORK_ERROR,
} from './WhistleButton'
import { formatWait, whistleSuccessMessage } from './whistleText'

// 030 T010/T023: "Avisar" with its confirmation and feedback.

const onStale = vi.fn()

function renderButton(props = {}) {
  return render(
    <WhistleButton groupId={3} debtId={42} debtorName="Juan Pérez" amountText="$ 8.000,00 ARS"
      onStale={onStale} {...props} />,
  )
}

async function openAndConfirm(user) {
  await user.click(screen.getByRole('button', { name: 'Avisar a Juan Pérez' }))
  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Avisar' }))
  return dialog
}

beforeEach(() => {
  for (const mock of [whistleDebt, setUser, showSnackbar, onStale]) mock.mockReset()
})

describe('WhistleButton: confirmación y envío (030 US1)', () => {
  it('abre la confirmación con el deudor, el monto y la aclaración de 24 horas', async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Avisar a Juan Pérez' }))

    const dialog = screen.getByRole('dialog', { name: 'Avisar a Juan Pérez' })
    expect(dialog).toHaveTextContent('Juan Pérez')
    expect(dialog).toHaveTextContent('$ 8.000,00 ARS')
    expect(dialog).toHaveTextContent(WHISTLE_LIMIT_NOTE)
    expect(whistleDebt).not.toHaveBeenCalled()
  })

  it('incluye el concepto cuando lo conoce', async () => {
    const user = userEvent.setup()
    renderButton({ concept: 'Cena' })
    await user.click(screen.getByRole('button', { name: 'Avisar a Juan Pérez' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('por «Cena»')
  })

  it('la × y Escape cierran sin llamar al API', async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByRole('button', { name: 'Avisar a Juan Pérez' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Avisar a Juan Pérez' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(whistleDebt).not.toHaveBeenCalled()
  })

  it('confirmar avisa, cierra y avisa con el snackbar', async () => {
    whistleDebt.mockResolvedValue({ ok: true, data: { whistleId: 1 } })
    const user = userEvent.setup()
    renderButton()

    await openAndConfirm(user)

    expect(whistleDebt).toHaveBeenCalledWith(3, 42)
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(whistleSuccessMessage('Juan Pérez')))
    expect(whistleSuccessMessage('Juan Pérez')).toBe('Le avisamos a Juan Pérez')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mientras envía no se puede confirmar dos veces', async () => {
    let resolve
    whistleDebt.mockReturnValue(new Promise((done) => { resolve = done }))
    const user = userEvent.setup()
    renderButton()

    const dialog = await openAndConfirm(user)
    expect(within(dialog).getByRole('button', { name: 'Avisando…' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(whistleDebt).toHaveBeenCalledTimes(1)
    resolve({ ok: true, data: {} })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('WhistleButton: perfiles simulados (030 Q3)', () => {
  it('el botón aparece deshabilitado con el texto visible y no abre nada', async () => {
    const user = userEvent.setup()
    renderButton({ simulated: true })

    const button = screen.getByRole('button', { name: 'Avisar a Juan Pérez' })
    expect(button).toBeDisabled()
    expect(screen.getByText(SIMULATED_NOTE)).toBeVisible()
    expect(button).toHaveAccessibleDescription(SIMULATED_NOTE)
    await user.click(button)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('WhistleButton: errores (030 FR-015)', () => {
  it('409 avisa, cierra y pide recargar la lista', async () => {
    whistleDebt.mockResolvedValue({ ok: false, status: 409, detail: 'La deuda ya no tiene saldo pendiente' })
    const user = userEvent.setup()
    renderButton()

    await openAndConfirm(user)

    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith('La deuda ya no tiene saldo pendiente'))
    expect(onStale).toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('503 muestra el mensaje dentro del modal y permite reintentar', async () => {
    whistleDebt
      .mockResolvedValueOnce({ ok: false, status: 503, detail: '' })
      .mockResolvedValueOnce({ ok: true, data: {} })
    const user = userEvent.setup()
    renderButton()

    const dialog = await openAndConfirm(user)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(WHISTLE_DELIVERY_ERROR)

    await user.click(within(dialog).getByRole('button', { name: 'Avisar' }))
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith('Le avisamos a Juan Pérez'))
  })

  it('un error de red se informa en el modal sin éxito falso', async () => {
    whistleDebt.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderButton()

    const dialog = await openAndConfirm(user)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(WHISTLE_NETWORK_ERROR)
    expect(showSnackbar).not.toHaveBeenCalled()
  })

  it.each([
    [403, 'Solo quien recibe el pago puede avisar esta deuda'],
    [422, 'Los perfiles simulados no reciben avisos'],
  ])('%s muestra el mensaje del servidor en el modal', async (status, detail) => {
    whistleDebt.mockResolvedValue({ ok: false, status, detail })
    const user = userEvent.setup()
    renderButton()
    const dialog = await openAndConfirm(user)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail)
  })

  it('sin detalle del servidor usa un mensaje genérico', async () => {
    whistleDebt.mockResolvedValue({ ok: false, status: 404, detail: '' })
    const user = userEvent.setup()
    renderButton()
    const dialog = await openAndConfirm(user)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(WHISTLE_NETWORK_ERROR)
  })

  it('401 cierra la sesión', async () => {
    whistleDebt.mockResolvedValue({ ok: false, status: 401 })
    const user = userEvent.setup()
    renderButton()
    await openAndConfirm(user)
    await waitFor(() => expect(setUser).toHaveBeenCalledWith(null))
  })
})

describe('WhistleButton: límite de 24 horas (030 T023)', () => {
  it('429 muestra cuánto falta en horas y minutos', async () => {
    whistleDebt.mockResolvedValue({ ok: false, status: 429, retryAfterSeconds: 63600 })
    const user = userEvent.setup()
    renderButton()

    const dialog = await openAndConfirm(user)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Ya le avisaste a Juan Pérez hace poco. Vas a poder volver a hacerlo en 17 h 40 min',
    )
  })

  it.each([
    [63600, '17 h 40 min'],
    [63601, '17 h 41 min'],
    [7200, '2 h'],
    [59, '1 min'],
    [1, '1 min'],
    [3540, '59 min'],
    [0, '1 min'],
    [undefined, '24 h'],
  ])('formatWait(%s) = %s, redondeando hacia arriba', (seconds, text) => {
    expect(formatWait(seconds)).toBe(text)
  })
})
