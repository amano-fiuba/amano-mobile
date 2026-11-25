import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  getReminderSettings: vi.fn(),
  updateGroup: vi.fn(),
  updateReminderSettings: vi.fn(),
}))

import {
  getReminderSettings,
  updateGroup,
  updateReminderSettings,
} from '../../api/groupsClient'
import { SnackbarProvider } from '../Snackbar'
import GroupDebtSettingsModal from './GroupDebtSettingsModal'
import { DEBT_DUE_DAYS_INVALID, DEBT_DUE_DAYS_REQUIRED } from './debtDueDays'

const GROUP = { id: 42, currentUserRole: 'ADMIN', debtDueDays: 15 }
const SETTINGS = {
  sendDays: 5,
  message: null,
  defaultSendDays: 5,
  allowedSendDays: [7, 5, 3, 2, 1],
}

function renderModal(props = {}) {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(
    <SnackbarProvider>
      <GroupDebtSettingsModal
        group={GROUP}
        isAdmin
        onClose={onClose}
        onSaved={onSaved}
        {...props}
      />
    </SnackbarProvider>,
  )
  return { onClose, onSaved }
}

beforeEach(() => {
  getReminderSettings.mockReset()
  updateGroup.mockReset()
  updateReminderSettings.mockReset()
  getReminderSettings.mockResolvedValue({ ok: true, settings: SETTINGS })
  updateGroup.mockResolvedValue({ ok: true, group: GROUP })
  updateReminderSettings.mockResolvedValue({ ok: true, settings: SETTINGS })
})

describe('GroupDebtSettingsModal (028)', () => {
  it('no se abre para quien no es administrador', () => {
    const { container } = render(
      <SnackbarProvider>
        <GroupDebtSettingsModal group={GROUP} isAdmin={false} onClose={() => {}} />
      </SnackbarProvider>,
    )

    expect(container).toBeEmptyDOMElement()
    expect(getReminderSettings).not.toHaveBeenCalled()
  })

  it('centraliza el plazo de pago y los campos de recordatorio', async () => {
    getReminderSettings.mockResolvedValue({
      ok: true,
      settings: { ...SETTINGS, sendDays: 2, message: 'Pagá cuando puedas' },
    })

    renderModal()

    expect(await screen.findByLabelText('Las deudas tienen vencimiento')).toBeChecked()
    expect(screen.getByLabelText('Días para el vencimiento de las deudas')).toHaveValue('15')
    expect(screen.getByText(/Aplica a los gastos nuevos/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Cuándo enviar el recordatorio')).toHaveValue('2')
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      '7 días antes', '5 días antes', '3 días antes', '2 días antes', '1 día antes',
    ])
    expect(screen.getByLabelText('Mensaje personalizado (opcional)')).toHaveValue('Pagá cuando puedas')
  })

  it('guarda plazo y recordatorios juntos y confirma con un snackbar', async () => {
    const { onSaved } = renderModal()

    fireEvent.change(await screen.findByLabelText('Días para el vencimiento de las deudas'), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByLabelText('Cuándo enviar el recordatorio'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Mensaje personalizado (opcional)'), {
      target: { value: 'Hola' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith(42, { debtDueDays: 30 }))
    expect(updateReminderSettings).toHaveBeenCalledWith(42, { sendDays: 2, message: 'Hola' })
    expect(await screen.findByRole('status')).toHaveTextContent(/Configuración de deudas actualizada/i)
    expect(onSaved).toHaveBeenCalled()
  })

  it('no envía el plazo si no cambió', async () => {
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateReminderSettings).toHaveBeenCalled())
    expect(updateGroup).not.toHaveBeenCalled()
  })

  it('acepta 0', async () => {
    const { onSaved } = renderModal()
    const input = await screen.findByLabelText('Días para el vencimiento de las deudas')

    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith(42, { debtDueDays: 0 }))
    expect(onSaved).toHaveBeenCalled()
  })

  it('sin vencimiento oculta los recordatorios y guarda null', async () => {
    const { onSaved } = renderModal()

    fireEvent.click(await screen.findByLabelText('Las deudas tienen vencimiento'))

    expect(screen.queryByLabelText('Días para el vencimiento de las deudas')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cuándo enviar el recordatorio')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mensaje personalizado (opcional)')).not.toBeInTheDocument()
    expect(screen.getByTestId('no-due-date-hint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith(42, { debtDueDays: null }))
    expect(updateReminderSettings).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalled()
  })

  it('sin vencimiento inicial pide los días al activarlo', async () => {
    renderModal({ group: { ...GROUP, debtDueDays: null } })
    const toggle = await screen.findByLabelText('Las deudas tienen vencimiento')

    expect(toggle).not.toBeChecked()
    expect(screen.queryByLabelText('Días para el vencimiento de las deudas')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    const input = screen.getByLabelText('Días para el vencimiento de las deudas')
    expect(input).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(screen.getByTestId('group-due-days-error')).toHaveTextContent(DEBT_DUE_DAYS_REQUIRED)
    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateReminderSettings).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(updateGroup).toHaveBeenCalledWith(42, { debtDueDays: 10 }))
    expect(updateReminderSettings).toHaveBeenCalled()
  })

  it('rechaza negativos, decimales, texto y más de 3650 sin llamar a la API', async () => {
    renderModal()
    const input = await screen.findByLabelText('Días para el vencimiento de las deudas')

    for (const bad of ['-1', '2,5', 'abc', '3651']) {
      fireEvent.change(input, { target: { value: bad } })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
      expect(screen.getByTestId('group-due-days-error')).toHaveTextContent(DEBT_DUE_DAYS_INVALID)
      expect(input).toHaveAttribute('aria-invalid', 'true')
    }
    expect(updateGroup).not.toHaveBeenCalled()
    expect(updateReminderSettings).not.toHaveBeenCalled()
  })

  it('muestra el error de plazo que devuelva el servidor', async () => {
    updateGroup.mockResolvedValue({
      ok: false,
      status: 400,
      fields: { debtDueDays: 'Los días para el vencimiento tienen que ser un número entero entre 0 y 3650' },
      detail: 'x',
    })
    renderModal()

    fireEvent.change(await screen.findByLabelText('Días para el vencimiento de las deudas'), {
      target: { value: '9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByTestId('group-due-days-error')).toHaveTextContent('entre 0 y 3650')
    expect(updateReminderSettings).not.toHaveBeenCalled()
  })

  it('muestra los errores de validación de recordatorios', async () => {
    updateReminderSettings.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'Revisá los datos',
      fields: { message: 'El mensaje no puede superar los 500 caracteres' },
    })
    renderModal()

    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cambios' }))

    expect(await screen.findByText('El mensaje no puede superar los 500 caracteres')).toBeInTheDocument()
    expect(screen.getByTestId('debt-settings-error')).toHaveTextContent(/Revisá los datos/i)
  })

  it('limita el mensaje a 500 caracteres y muestra el contador', async () => {
    renderModal()

    const textarea = await screen.findByLabelText('Mensaje personalizado (opcional)')
    expect(textarea).toHaveAttribute('maxLength', '500')
    expect(screen.getByTestId('reminder-message-counter')).toHaveTextContent('0/500')

    fireEvent.change(textarea, { target: { value: 'Hola' } })
    expect(screen.getByTestId('reminder-message-counter')).toHaveTextContent('4/500')
  })

  it('si falla la carga permite reintentar', async () => {
    getReminderSettings
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, settings: SETTINGS })
    renderModal()

    expect(await screen.findByTestId('debt-settings-load-error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByLabelText('Días para el vencimiento de las deudas')).toBeInTheDocument()
  })

  it('se cierra desde el aspa del modal', async () => {
    const { onClose } = renderModal()

    await screen.findByLabelText('Días para el vencimiento de las deudas')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onClose).toHaveBeenCalled()
  })
})
