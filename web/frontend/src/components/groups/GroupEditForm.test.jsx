import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/groupsClient', async (importOriginal) => ({
  ...await importOriginal(),
  updateGroup: vi.fn(),
  uploadGroupPhoto: vi.fn(),
  deleteGroupPhoto: vi.fn(),
  getGroup: vi.fn(),
}))

import { deleteGroupPhoto, getGroup, updateGroup, uploadGroupPhoto } from '../../api/groupsClient'
import GroupEditForm from './GroupEditForm'

const group = { id: 3, name: 'Viaje', description: 'Desc', photo: '/api/groups/3/photo?v=a' }

beforeEach(() => {
  vi.resetAllMocks()
  getGroup.mockResolvedValue({ ok: true, group: { ...group, name: 'Nuevo' } })
  updateGroup.mockResolvedValue({ ok: true, group })
  deleteGroupPhoto.mockResolvedValue({ ok: true })
  uploadGroupPhoto.mockResolvedValue({ ok: true })
})

describe('GroupEditForm', () => {
  it('guarda nombre y descripción', async () => {
    const onSaved = vi.fn()
    render(<GroupEditForm group={group} onSaved={onSaved} />)

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Otra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updateGroup).toHaveBeenCalledWith(3, { name: 'Nuevo', description: 'Otra' })
    expect(deleteGroupPhoto).not.toHaveBeenCalled()
  })

  it('elimina la foto solo al guardar', async () => {
    const onSaved = vi.fn()
    render(<GroupEditForm group={group} onSaved={onSaved} />)

    fireEvent.click(screen.getByTestId('group-photo-remove'))
    expect(deleteGroupPhoto).not.toHaveBeenCalled()
    expect(screen.getByAltText('')).toHaveAttribute('src', '/avatar-default.png')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(deleteGroupPhoto).toHaveBeenCalledWith(3))
    expect(updateGroup).not.toHaveBeenCalled()
  })

  it('sube una foto nueva al guardar', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    render(<GroupEditForm group={group} onSaved={() => {}} />)

    // PNG real (magic bytes): ya entra en 2 MB y se sube tal cual.
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])], 'a.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('group-photo-input'), { target: { files: [file] } })
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(file))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(uploadGroupPhoto).toHaveBeenCalledWith(3, file))
  })

  it('no tiene botón Cancelar: el panel se cierra desde la cabecera', () => {
    render(<GroupEditForm group={group} onSaved={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()
  })

  it('rechaza un nombre vacío', () => {
    render(<GroupEditForm group={group} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/obligatorio/)
    expect(updateGroup).not.toHaveBeenCalled()
  })
})
