import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  leaveGroup: vi.fn(),
}))

import { leaveGroup } from '../../api/groupsClient'
import LeaveGroupPanel from './LeaveGroupPanel'

function renderPanel(props) {
  return render(
    <MemoryRouter initialEntries={['/groups/42']}>
      <Routes>
        <Route path="/groups/42" element={<LeaveGroupPanel groupId={42} {...props} />} />
        <Route path="/groups" element={<p>Mis grupos</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  leaveGroup.mockReset()
})

describe('LeaveGroupPanel (T068/T065)', () => {
  it('muestra la confirmación cuando el usuario no es el último admin', () => {
    renderPanel({ isLastAdmin: false })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(screen.getByRole('dialog', { name: 'Salir del grupo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument()
    expect(leaveGroup).not.toHaveBeenCalled()
  })

  it('si el usuario es último admin muestra la guía de asignar otro admin y no sale', async () => {
    renderPanel({ isLastAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(
      await screen.findByText(/Sos el último administrador: asigná otro administrador antes de salir/i),
    ).toBeInTheDocument()
    expect(leaveGroup).not.toHaveBeenCalled()
  })

  it('abandona el grupo tras confirmar, avisa y vuelve al listado', async () => {
    leaveGroup.mockResolvedValue({ ok: true, groupLeft: true })

    renderPanel({ isLastAdmin: false })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(42))
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Se abandonó el grupo/i)
  })

  it('renderiza el motivo del rechazo server-side', async () => {
    leaveGroup.mockResolvedValue({
      ok: false,
      status: 403,
      detail: 'No podés abandonar el grupo: tenés saldos pendientes con otros miembros',
    })

    renderPanel({ isLastAdmin: false })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/saldos pendientes/i)
  })

  it('si es el último miembro avisa que el grupo se eliminará, confirma y vuelve a Mis grupos', async () => {
    leaveGroup.mockResolvedValue({ ok: true, groupLeft: true, groupDeleted: true })

    renderPanel({ isLastAdmin: true, isLastMember: true })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(
      screen.getByText('Sos el último miembro: si confirmas, el grupo se eliminará'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/asigná otro administrador/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith(42))
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Se eliminó el grupo/i)
  })

  it('como único admin con otros miembros no ofrece salir y Cerrar no llama a la API', () => {
    renderPanel({ isLastAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))

    expect(screen.queryByRole('button', { name: /Confirmar/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(leaveGroup).not.toHaveBeenCalled()
  })

  it('el doble clic en Confirmar envía una sola solicitud', async () => {
    let resolve
    leaveGroup.mockReturnValue(new Promise((r) => { resolve = r }))
    renderPanel({})

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    const confirm = screen.getByRole('button', { name: /Confirmar/i })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    expect(leaveGroup).toHaveBeenCalledTimes(1)
    resolve({ ok: true, groupLeft: true })
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument()
  })

  it('tras un error de red permite reintentar', async () => {
    leaveGroup
      .mockResolvedValueOnce({ ok: false, network: true })
      .mockResolvedValueOnce({ ok: true, groupLeft: true })
    renderPanel({})

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/No se pudo conectar/i)
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))
    expect(await screen.findByText('Mis grupos')).toBeInTheDocument()
  })

  it('el mensaje de éxito lo define el servidor, no el modo del modal', async () => {
    leaveGroup.mockResolvedValue({ ok: true, groupLeft: true, groupDeleted: false })
    renderPanel({ isLastMember: true })

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Se abandonó el grupo/i)
  })
})
