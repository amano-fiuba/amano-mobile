import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  grantAdminRole: vi.fn(),
  revokeAdminRole: vi.fn(),
}))

import { grantAdminRole, revokeAdminRole } from '../../api/groupsClient'
import AdminRolePanel from './AdminRolePanel'

const MEMBER = { userId: 15, name: 'Carla Pérez', role: 'MEMBER' }

beforeEach(() => {
  grantAdminRole.mockReset()
  revokeAdminRole.mockReset()
})

describe('AdminRolePanel (T075/T071)', () => {
  it('asigna el rol de admin a un miembro', async () => {
    grantAdminRole.mockResolvedValue({ ok: true, targetUserId: 15, newRole: 'ADMIN' })

    render(
      <AdminRolePanel
        groupId={42}
        members={[MEMBER]}
        currentUserId={7}
        currentAdminIds={[7, 9]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Asignar admin/i }))
    await waitFor(() => expect(grantAdminRole).toHaveBeenCalledWith(42, 15))
    expect(await screen.findByRole('status')).toHaveTextContent(/ahora es administrador/i)
  })

  it('revoca el rol de admin y el mensaje indica que pasa a miembro', async () => {
    revokeAdminRole.mockResolvedValue({ ok: true, targetUserId: 33, newRole: 'MEMBER' })

    render(
      <AdminRolePanel
        groupId={42}
        members={[{ userId: 33, name: 'Beto Gómez', role: 'ADMIN' }, MEMBER]}
        currentUserId={7}
        currentAdminIds={[7, 33]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Quitar admin a Beto Gómez/i }))
    await waitFor(() => expect(revokeAdminRole).toHaveBeenCalledWith(42, 33))
    expect(await screen.findByRole('status')).toHaveTextContent(/miembro/i)
  })

  it('deshabilita la acción para el último admin con la explicación', () => {
    render(
      <AdminRolePanel
        groupId={42}
        members={[{ userId: 33, name: 'Beto Gómez', role: 'ADMIN' }]}
        currentUserId={7}
        currentAdminIds={[33]}
      />,
    )

    expect(screen.getByRole('button', { name: /Último/i })).toBeDisabled()
    expect(
      screen.getByText(/Sos el último administrador: asigná otro administrador antes de salir/i),
    ).toBeInTheDocument()
  })

  it('renderiza el motivo del rechazo server-side', async () => {
    grantAdminRole.mockResolvedValue({
      ok: false,
      status: 403,
      detail: 'No sos admin de este grupo',
    })

    render(
      <AdminRolePanel
        groupId={42}
        members={[MEMBER]}
        currentUserId={77}
        currentAdminIds={[33]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Asignar admin/i }))

    expect(await screen.findByTestId('admin-roles-error')).toHaveTextContent(/No sos admin/i)
  })
})
