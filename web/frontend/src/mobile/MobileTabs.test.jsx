import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileTabs, { MobileTab, MobileTabGroup } from './MobileTabs'

afterEach(() => {
  window.sessionStorage.clear()
})

function Screen({ mobile, ...props }) {
  return (
    <MobileTabs name="prueba" label="Secciones" className="columnas" mobile={mobile} {...props}>
      <MobileTab id="a" label="Grupos">
        <p>Contenido A</p>
      </MobileTab>
      <MobileTabGroup className="grupo">
        <MobileTab id="b" label="Actividad" badge={3}>
          <p>Contenido B</p>
        </MobileTab>
        <MobileTab id="c" label="Solicitudes">
          <p>Contenido C</p>
        </MobileTab>
      </MobileTabGroup>
    </MobileTabs>
  )
}

describe('MobileTabs en la web', () => {
  it('dibuja el mismo HTML de siempre: contenedor y secciones, sin pestañas', () => {
    const { container } = render(<Screen mobile={false} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(container.querySelector('.columnas > p')).toHaveTextContent('Contenido A')
    expect(container.querySelector('.columnas > .grupo').children).toHaveLength(2)
  })

  it('sin className no agrega ningún contenedor', () => {
    const { container } = render(
      <MobileTabs mobile={false}>
        <MobileTab id="a" label="A">
          <p>Solo</p>
        </MobileTab>
      </MobileTabs>,
    )
    expect(container.firstChild.tagName).toBe('P')
  })
})

describe('MobileTabs en la app', () => {
  it('muestra una sección por vez, con todas montadas', () => {
    render(<Screen mobile />)
    expect(screen.getByRole('tab', { name: 'Grupos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Contenido A')).toBeVisible()
    expect(screen.getByText('Contenido B')).not.toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: /actividad/i }))
    expect(screen.getByText('Contenido B')).toBeVisible()
    expect(screen.getByText('Contenido A')).not.toBeVisible()
  })

  it('muestra el contador de la pestaña', () => {
    render(<Screen mobile />)
    expect(screen.getByRole('tab', { name: /actividad/i })).toHaveTextContent('3')
  })

  it('recuerda la pestaña elegida al volver a la pantalla', () => {
    const { unmount } = render(<Screen mobile />)
    fireEvent.click(screen.getByRole('tab', { name: 'Solicitudes' }))
    unmount()
    render(<Screen mobile />)
    expect(screen.getByRole('tab', { name: 'Solicitudes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('se navega con las flechas del teclado', () => {
    render(<Screen mobile />)
    const first = screen.getByRole('tab', { name: 'Grupos' })
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Solicitudes' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Solicitudes' }), { key: 'Home' })
    expect(first).toHaveAttribute('aria-selected', 'true')
  })

  it('deslizar hacia la izquierda pasa a la pestaña siguiente', () => {
    const { container } = render(<Screen mobile />)
    const root = container.querySelector('.mobile-tabs')
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 200 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 120, clientY: 210 }] })
    expect(screen.getByRole('tab', { name: /actividad/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('un gesto vertical no cambia de pestaña', () => {
    const { container } = render(<Screen mobile />)
    const root = container.querySelector('.mobile-tabs')
    fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] })
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 220, clientY: 400 }] })
    expect(screen.getByRole('tab', { name: 'Grupos' })).toHaveAttribute('aria-selected', 'true')
  })

  it('respeta otro orden para el celular', () => {
    render(<Screen mobile order={['c', 'a', 'b']} />)
    const names = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(names[0]).toBe('Solicitudes')
    expect(screen.getByRole('tab', { name: 'Solicitudes' })).toHaveAttribute('aria-selected', 'true')
  })

  it('puede controlarse desde afuera (pasos de un formulario)', () => {
    const onChange = vi.fn()
    render(<Screen mobile variant="steps" active="b" onChange={onChange} />)
    expect(screen.getByRole('tab', { name: /actividad/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /actividad/i })).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('tab', { name: /solicitudes/i }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('con una sola sección no muestra pestañas', () => {
    render(
      <MobileTabs mobile>
        <MobileTab id="a" label="A">
          <p>Único</p>
        </MobileTab>
      </MobileTabs>,
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Único')).toBeVisible()
  })
})
