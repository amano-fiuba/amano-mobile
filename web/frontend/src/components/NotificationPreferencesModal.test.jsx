import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationPreferencesModal, { PREFERENCES_SAVE_ERROR_MESSAGE } from './NotificationPreferencesModal'

const { getPreferences, updatePreferences } = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}))
vi.mock('../api/notificationsClient', () => ({ getPreferences, updatePreferences }))

const PREFERENCES = {
  channels: { inApp: true, email: true },
  eventTypes: {
    remindersAndWhistles: true,
    debtDueAndPendingCollections: true,
    groupActivity: true,
    friendActivity: true,
  },
}

function renderModal(onClose = vi.fn()) {
  return { onClose, ...render(<NotificationPreferencesModal open onClose={onClose} />) }
}

beforeEach(() => {
  getPreferences.mockReset()
  updatePreferences.mockReset()
  getPreferences.mockResolvedValue({ ok: true, preferences: PREFERENCES })
  updatePreferences.mockResolvedValue({ ok: true, preferences: PREFERENCES })
})

describe('NotificationPreferencesModal (035 US4)', () => {
  it('lleva el foco al primer control al abrir (T042)', async () => {
    renderModal()
    await screen.findByRole('region', { name: 'Configuración de notificaciones' })

    expect(screen.getByLabelText('In-App (bandeja)')).toHaveFocus()
  })

  it('muestra los seis booleanos con los valores actuales', async () => {
    getPreferences.mockResolvedValue({
      ok: true,
      preferences: { ...PREFERENCES, channels: { inApp: true, email: false } },
    })
    renderModal()

    expect(await screen.findByRole('region', { name: 'Configuración de notificaciones' })).toHaveAttribute('aria-labelledby', 'preferences-title')
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.getByLabelText('Correo electrónico')).not.toBeChecked()
    expect(screen.getByLabelText('In-App (bandeja)')).toBeChecked()
    expect(screen.getByLabelText('Actividad de grupo')).toBeChecked()
  })

  it('guarda los seis valores y cierra el modal', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await screen.findByLabelText('Correo electrónico')

    await user.click(screen.getByLabelText('Correo electrónico'))
    await user.click(screen.getByLabelText('Actividad de grupo'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({
      channels: { inApp: true, email: false },
      eventTypes: {
        remindersAndWhistles: true,
        debtDueAndPendingCollections: true,
        groupActivity: false,
        friendActivity: true,
      },
    }))
    expect(onClose).toHaveBeenCalled()
  })

  it('cancelar no guarda y cierra', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await screen.findByLabelText('Correo electrónico')

    await user.click(screen.getByLabelText('Correo electrónico'))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(updatePreferences).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('un error de guardado se informa y permite reintentar sin perder cambios', async () => {
    const user = userEvent.setup()
    updatePreferences.mockResolvedValueOnce({ ok: false, status: 400 })
    renderModal()
    await screen.findByLabelText('In-App (bandeja)')

    await user.click(screen.getByLabelText('In-App (bandeja)'))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(PREFERENCES_SAVE_ERROR_MESSAGE)
    expect(screen.getByLabelText('In-App (bandeja)')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('se cierra con Escape', async () => {
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await screen.findByRole('region', { name: 'Configuración de notificaciones' })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
