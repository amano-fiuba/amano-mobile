import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LeaveGroupModal from './LeaveGroupModal'

function renderModal(props) {
  const handlers = { onConfirm: vi.fn(), onClose: vi.fn() }
  render(<LeaveGroupModal mode="confirm" {...handlers} {...props} />)
  return handlers
}

describe('LeaveGroupModal (spec 020)', () => {
  it('modo confirm: pregunta y ofrece Confirmar y la equis (sin Cancelar)', () => {
    const { onConfirm, onClose } = renderModal()

    expect(screen.getByText('¿Seguro que querés abandonar el grupo?'))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('modo last-admin: texto exacto y la equis como único botón', () => {
    const { onClose } = renderModal({ mode: 'last-admin' })

    expect(screen.getByText('Sos el último administrador: asigná otro administrador antes de salir'))
      .toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('modo last-member: texto exacto con Confirmar y la equis', () => {
    renderModal({ mode: 'last-member' })

    expect(screen.getByText('Sos el último miembro: si confirmas, el grupo se eliminará'))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
  })

  it('es un diálogo con nombre accesible y toma el foco al abrir', () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: 'Salir del grupo' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('Escape cierra', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('con una solicitud en curso no se puede cerrar ni confirmar', () => {
    const { onClose } = renderModal({ busy: true })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
  })

  it('muestra el error dentro del modal', () => {
    renderModal({ error: 'tenés saldos pendientes' })

    expect(screen.getByRole('alert')).toHaveTextContent('tenés saldos pendientes')
  })
})
