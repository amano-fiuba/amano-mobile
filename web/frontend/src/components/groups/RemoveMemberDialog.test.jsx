import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  removeMember: vi.fn(),
  removeSimulatedProfile: vi.fn(),
}))

import { removeMember, removeSimulatedProfile } from '../../api/groupsClient'
import RemoveMemberDialog from './RemoveMemberDialog'

const MEMBER = { userId: 15, name: 'Carla Pérez', role: 'MEMBER' }
const SIMULATED = { profileId: 33, name: 'Juan Simulado', email: 'simulado@amano.dev' }

beforeEach(() => {
  removeMember.mockReset()
  removeSimulatedProfile.mockReset()
})

describe('RemoveMemberDialog (T062/T057)', () => {
  it('se muestra como modal, sin Cancelar: la equis o Escape lo cierran', () => {
    const onClose = vi.fn()
    render(<RemoveMemberDialog groupId={42} member={MEMBER} onClose={onClose} />)

    expect(screen.getByRole('dialog', { name: /Eliminar miembro/i })).toHaveAttribute('aria-modal', 'true')
    expect(screen.queryByRole('button', { name: /Cancelar/i })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /Cerrar/i }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(removeMember).not.toHaveBeenCalled()
  })

  it('pide confirmación antes de eliminar al miembro', async () => {
    removeMember.mockResolvedValue({ ok: true, removed: true })

    render(<RemoveMemberDialog groupId={42} member={MEMBER} />)

    expect(screen.getByRole('dialog', { name: /Eliminar miembro/i })).toBeInTheDocument()
    expect(removeMember).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith(42, 15))
    expect(await screen.findByRole('status')).toHaveTextContent(/Carla Pérez ya no forma parte del grupo/i)
  })

  it('muestra la pista de revocar el rol primero para otro admin', async () => {
    render(<RemoveMemberDialog groupId={42} member={{ ...MEMBER, role: 'ADMIN' }} />)


    expect(
      await screen.findByText(/No podés eliminar directamente a otro administrador: primero quitale el rol/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancelar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cerrar/i })).toBeInTheDocument()
  })

  it('renderiza el motivo del rechazo server-side', async () => {
    removeMember.mockResolvedValue({
      ok: false,
      status: 403,
      detail: 'No podés eliminarla: tiene deudas pendientes con otros miembros del grupo',
    })

    render(<RemoveMemberDialog groupId={42} member={MEMBER} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tiene deudas pendientes/i,
    )
  })

  it('elimina un perfil simulado de forma física con la misma confirmación', async () => {
    removeSimulatedProfile.mockResolvedValue({ ok: true, removed: true })

    render(<RemoveMemberDialog groupId={42} simulatedProfile={SIMULATED} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(removeSimulatedProfile).toHaveBeenCalledWith(42, 33))
    expect(await screen.findByRole('status')).toHaveTextContent(/Juan Simulado ya no forma parte del grupo/i)
  })

  it('al eliminar con éxito cierra el diálogo y avisa con onRemoved (fix 2026-11-04)', async () => {
    const onRemoved = vi.fn()
    removeSimulatedProfile.mockResolvedValue({ ok: true, removed: true })

    const onClose = vi.fn()
    render(<RemoveMemberDialog groupId={42} simulatedProfile={SIMULATED} onRemoved={onRemoved} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('si el servidor rechaza no llama a onRemoved', async () => {
    const onRemoved = vi.fn()
    removeMember.mockResolvedValue({ ok: false, status: 403, detail: 'No sos admin de este grupo' })

    render(<RemoveMemberDialog groupId={42} member={MEMBER} onRemoved={onRemoved} />)

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByTestId('remove-member-error')).toHaveTextContent('No sos admin de este grupo')
    expect(onRemoved).not.toHaveBeenCalled()
  })
})
