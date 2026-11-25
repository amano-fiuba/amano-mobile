import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './copyToClipboard'

function stubClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

afterEach(() => {
  delete navigator.clipboard
  delete document.execCommand
  vi.restoreAllMocks()
})

describe('copyToClipboard', () => {
  it('usa navigator.clipboard cuando está disponible', async () => {
    const writeText = vi.fn().mockResolvedValue()
    stubClipboard(writeText)

    await expect(copyToClipboard('0000003100010000000001')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('0000003100010000000001')
  })

  it('cae al textarea temporal cuando no hay Clipboard API', async () => {
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    await expect(copyToClipboard('123')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).not.toBeInTheDocument()
  })

  it('cae al textarea si la Clipboard API rechaza (permiso/contexto)', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    await expect(copyToClipboard('456')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).not.toBeInTheDocument()
  })

  it('devuelve false si el valor está vacío', async () => {
    await expect(copyToClipboard(null)).resolves.toBe(false)
    await expect(copyToClipboard('')).resolves.toBe(false)
  })

  it('devuelve false si ningún mecanismo pudo copiar', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')))
    document.execCommand = vi.fn().mockReturnValue(false)

    await expect(copyToClipboard('789')).resolves.toBe(false)
    expect(document.querySelector('textarea')).not.toBeInTheDocument()
  })
})
