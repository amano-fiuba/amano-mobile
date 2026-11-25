import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import GroupDescriptionPanel from './GroupDescriptionPanel'

describe('GroupDescriptionPanel (T081/T080, US7)', () => {
  it('muestra la descripción cuando el grupo tiene una', () => {
    render(<GroupDescriptionPanel description="Gastos compartidos del depto" />)

    const panel = screen.getByTestId('group-description')
    expect(panel).toHaveTextContent('Gastos compartidos del depto')
  })

  it('no muestra nada cuando es NULL o vacía', () => {
    const { container, rerender } = render(<GroupDescriptionPanel description={null} />)
    expect(container).toBeEmptyDOMElement()

    rerender(<GroupDescriptionPanel description="   " />)
    expect(container).toBeEmptyDOMElement()
  })

  it('soporta valores multilinea sin perder el contenido', () => {
    const { container } = render(<GroupDescriptionPanel description={'Línea 1\nLínea 2'} />)

    const panel = screen.getByTestId('group-description')
    expect(panel).toHaveTextContent('Línea 1')
    expect(panel).toHaveTextContent('Línea 2')
    expect(container.querySelectorAll('br')).toHaveLength(1) // el salto se conserva
  })
})
