import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import DeleteFriendDialog, {
  DELETE_CONFIRM_LABEL,
  DELETE_DIALOG_TITLE,
  DELETING_LABEL,
} from './DeleteFriendDialog'

const ANA = { id: 12, firstName: 'Ana', lastName: 'Pérez' }

describe('DeleteFriendDialog (feature 016)', () => {
  it('muestra el nombre del amigo y las acciones de confirmación', () => {
    render(<DeleteFriendDialog friend={ANA} onCancel={vi.fn()} onConfirm={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: DELETE_DIALOG_TITLE })
    expect(dialog).toBeInTheDocument()
    expect(
      screen.getByText('¿Querés eliminar a Ana Pérez de tus amigos?'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: DELETE_CONFIRM_LABEL })).toBeInTheDocument()
  })

  it('omite el apellido nulo en el mensaje', () => {
    render(
      <DeleteFriendDialog
        friend={{ id: 8, firstName: 'Bruno', lastName: null }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText('¿Querés eliminar a Bruno de tus amigos?')).toBeInTheDocument()
  })

  it('la equis llama a onCancel y no a onConfirm', async () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DeleteFriendDialog friend={ANA} onCancel={onCancel} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Escape cancela cuando no hay una eliminación en curso', () => {
    const onCancel = vi.fn()
    render(<DeleteFriendDialog friend={ANA} onCancel={onCancel} onConfirm={vi.fn()} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('durante la eliminación deshabilita las acciones y muestra "Eliminando…"', () => {
    const onCancel = vi.fn()
    render(
      <DeleteFriendDialog friend={ANA} isDeleting onCancel={onCancel} onConfirm={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: DELETING_LABEL })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('muestra el error de la operación', () => {
    render(
      <DeleteFriendDialog
        friend={ANA}
        error="No se pudo eliminar al amigo. Intentá nuevamente"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo eliminar al amigo. Intentá nuevamente',
    )
  })
})
