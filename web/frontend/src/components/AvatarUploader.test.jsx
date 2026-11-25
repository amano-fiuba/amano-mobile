import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AvatarUploader from './AvatarUploader'
import { installFakeImageDecoder } from '../utils/fakeImageDecoder'

// US3 live avatar contract (task T035, written BEFORE the component):
// FR-010/FR-013 live format/size validation with Spanish messages; the field
// is optional — an empty selection never blocks the rest of the form (FR-003).
beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function jpegFile(name, sizeBytes = 12) {
  // Real JPEG magic bytes (FF D8 FF) so the check matches the backend (D6).
  const bytes = new Uint8Array(sizeBytes)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  return new File([bytes], name, { type: 'image/jpeg' })
}

function pngFile(name, sizeBytes = 12) {
  const bytes = new Uint8Array(sizeBytes)
  bytes[0] = 0x89
  bytes[1] = 0x50
  bytes[2] = 0x4e
  bytes[3] = 0x47
  return new File([bytes], name, { type: 'image/png' })
}

function gifFileLyingAsJpeg(name) {
  const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  return new File([bytes], name, { type: 'image/jpeg' })
}

function renderUploader() {
  const onFileSelected = vi.fn()
  render(<AvatarUploader onFileSelected={onFileSelected} />)
  return onFileSelected
}

describe('AvatarUploader (T035)', () => {
  it('el label no lleva la marca "(opcional)" (T044, FR-023)', () => {
    renderUploader()

    const label = screen.getByLabelText(/avatar/i).closest('label')
    expect(label).toHaveTextContent('Avatar')
    expect(label.textContent).not.toContain('(opcional)')
  })

  it('sin archivo no muestra error y no bloquea el resto del form (FR-003)', () => {
    renderUploader()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('JPG válido (< 2 MB) → live valid pasa y entrega el archivo (FR-013)', async () => {
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    const input = screen.getByLabelText(/avatar/i)
    await user.upload(input, jpegFile('ana.jpg'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onFileSelected).toHaveBeenCalledWith(expect.any(File))
  })

  it('PNG válido pasa igual (FR-010)', async () => {
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/avatar/i), pngFile('ana.png'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onFileSelected).toHaveBeenCalledWith(expect.any(File))
  })

  it('MIME declarado mentiroso → mensaje exacto de formato y no entrega el archivo (FR-010/FR-022, D6)', async () => {
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/avatar/i), gifFileLyingAsJpeg('trampa.jpg'))

    expect(
      await screen.findByText('El archivo debe ser una imagen JPG o PNG válida'),
    ).toBeInTheDocument()
    expect(onFileSelected).not.toHaveBeenCalled()
  })

  it('foto pesada (> 2 MB) → se achica a un JPG de 2 MB o menos y se entrega (mobile 002)', async () => {
    const restore = installFakeImageDecoder()
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/avatar/i), jpegFile('grande.jpg', 8 * 1024 * 1024))

    await vi.waitFor(() => expect(onFileSelected).toHaveBeenCalled())
    const delivered = onFileSelected.mock.calls.at(-1)[0]
    expect(delivered.type).toBe('image/jpeg')
    expect(delivered.size).toBeLessThanOrEqual(2 * 1024 * 1024)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    restore()
  })

  it('> 25 MB → mensaje exacto de tamaño y no entrega el archivo', async () => {
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/avatar/i), jpegFile('enorme.jpg', 25 * 1024 * 1024 + 1))

    expect(
      await screen.findByText('La imagen es demasiado grande (máximo 25 MB)'),
    ).toBeInTheDocument()
    expect(onFileSelected).not.toHaveBeenCalled()
  })

  it('quitar el archivo vuelve al estado limpio (opcional)', async () => {
    const onFileSelected = renderUploader()
    const user = userEvent.setup()

    await user.upload(screen.getByLabelText(/avatar/i), jpegFile('ana.jpg'))
    await user.click(screen.getByRole('button', { name: /quitar/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(onFileSelected).toHaveBeenLastCalledWith(null)
  })
})
