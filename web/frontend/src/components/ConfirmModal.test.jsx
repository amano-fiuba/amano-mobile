import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfirmModal from './ConfirmModal'

function renderModal(props) {
  const handlers = { onClose: vi.fn(), onConfirm: vi.fn() }
  render(
    <ConfirmModal title="Título" {...handlers} {...props}>
      <p>Mensaje</p>
    </ConfirmModal>,
  )
  return handlers
}

describe('ConfirmModal', () => {
  it('es un diálogo modal con título, mensaje y foco en la equis', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Título' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Mensaje')
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('solo tiene la equis y Confirmar: no hay botón Cancelar', () => {
    const { onClose, onConfirm } = renderModal()

    expect(screen.getAllByRole('button')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sin onConfirm es informativo: la equis es el único botón', () => {
    renderModal({ onConfirm: undefined })

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('acepta etiquetas propias para Confirmar', () => {
    renderModal({ confirmLabel: 'Eliminar', busyConfirmLabel: 'Eliminando…' })
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument()
  })

  it('Escape cierra, salvo con una solicitud en curso', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('con busy deshabilita todo e ignora Escape', () => {
    const { onClose } = renderModal({ busy: true, busyConfirmLabel: 'Procesando…' })

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()
  })

  it('muestra el error dentro del modal', () => {
    renderModal({ error: 'Algo falló', errorTestId: 'err' })
    expect(screen.getByTestId('err')).toHaveTextContent('Algo falló')
    expect(screen.getByRole('alert')).toHaveTextContent('Algo falló')
  })
})
