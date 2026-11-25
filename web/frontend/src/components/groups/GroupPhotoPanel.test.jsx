import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GroupPhotoPanel from './GroupPhotoPanel'

describe('GroupPhotoPanel', () => {
  it('sin foto muestra el avatar por defecto', () => {
    render(<GroupPhotoPanel photo={null} />)
    expect(screen.getByAltText('')).toHaveAttribute('src', '/avatar-default.png')
  })

  it('en modo lectura no ofrece subir ni eliminar', () => {
    render(<GroupPhotoPanel photo="/api/groups/3/photo?v=a" />)
    expect(screen.queryByLabelText(/Subir foto/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('group-photo-remove')).not.toBeInTheDocument()
  })

  it('al editar permite elegir un archivo y eliminarlo', () => {
    const onPick = vi.fn()
    const onRemove = vi.fn()
    render(<GroupPhotoPanel photo="/api/groups/3/photo?v=a" editing onPick={onPick} onRemove={onRemove} />)

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('group-photo-input'), { target: { files: [file] } })
    expect(onPick).toHaveBeenCalledWith(file)

    fireEvent.click(screen.getByTestId('group-photo-remove'))
    expect(onRemove).toHaveBeenCalled()
  })

  it('sin foto no muestra "Eliminar foto"', () => {
    render(<GroupPhotoPanel photo={null} editing />)
    expect(screen.queryByTestId('group-photo-remove')).not.toBeInTheDocument()
  })
})
