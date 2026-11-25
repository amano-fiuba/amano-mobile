import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CopyCbuButton from './CopyCbuButton'

afterEach(() => {
  delete navigator.clipboard
})

function stubClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
}

describe('CopyCbuButton', () => {
  it('no renderiza nada cuando no hay CBU/CVU informado', () => {
    const { container } = render(<CopyCbuButton value={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('copia el valor y confirma en el propio botón', async () => {
    const onCopied = vi.fn()
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue()
    stubClipboard(writeText) // después de setup: userEvent instala el suyo

    render(<CopyCbuButton value="0000003100010000000001" onCopied={onCopied} />)

    await user.click(screen.getByRole('button', { name: 'Copiar CBU/CVU' }))

    expect(writeText).toHaveBeenCalledWith('0000003100010000000001')
    expect(onCopied).toHaveBeenCalledWith('0000003100010000000001')
    expect(screen.getByRole('button', { name: 'Copiar CBU/CVU' })).toHaveTextContent('¡Copiado!')
  })

  it('con iconOnly muestra solo el icono y conserva el texto accesible oculto', () => {
    render(<CopyCbuButton value="0000003100010000000001" iconOnly />)

    const button = screen.getByRole('button', { name: 'Copiar CBU/CVU' })
    expect(button).toHaveClass('copy-cbu--icon-only')
    expect(screen.getByText('Copiar CBU/CVU')).toHaveClass('visually-hidden')
  })

  it('permite personalizar la etiqueta accesible (menú de miembros)', () => {
    render(
      <CopyCbuButton value="1234567890123456789012" ariaLabel="Copiar CBU/CVU de Carla" />,
    )

    expect(
      screen.getByRole('button', { name: 'Copiar CBU/CVU de Carla' }),
    ).toHaveTextContent('Copiar CBU/CVU')
  })
})
