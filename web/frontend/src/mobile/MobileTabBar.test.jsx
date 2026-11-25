import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileTabBar from './MobileTabBar'
import { isTopLevelPath } from './mobileLayout'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, firstName: 'Ana', lastName: 'Gómez' }, setUser: () => {} }),
}))

afterEach(() => {
  delete document.documentElement.dataset.tabBar
})

function renderAt(path, mobile = true) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileTabBar mobile={mobile} />
    </MemoryRouter>,
  )
}

describe('MobileTabBar', () => {
  it('en la web no dibuja nada', () => {
    renderAt('/', false)
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument()
  })

  it('en la app muestra Inicio, Grupos, Actividad y Más, con la sección activa', () => {
    renderAt('/groups')
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    expect(nav).toHaveTextContent(/Inicio.*Grupos.*Actividad.*Más/)
    expect(screen.getByRole('link', { name: 'Grupos' })).toHaveClass('is-active')
    expect(document.documentElement.dataset.tabBar).toBe('on')
  })

  it('"Más" abre el resto de las secciones y el perfil', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'Más' }))
    const sheet = screen.getByRole('dialog', { name: 'Más opciones' })
    expect(sheet).toHaveTextContent('Ana Gómez')
    for (const name of ['Notificaciones', 'Amigos', 'Buscar personas', 'Estadísticas', 'Gastos recurrentes']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cambiar a modo/i })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('en pantallas de detalle y formularios se oculta', () => {
    renderAt('/groups/3/expenses/new')
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument()
    expect(document.documentElement.dataset.tabBar).toBe('off')
  })
})

describe('isTopLevelPath', () => {
  it.each([
    ['/', true],
    ['/groups', true],
    ['/groups/12', true],
    ['/activity', true],
    ['/profile', true],
    ['/notifications', true],
    ['/profile/edit', false],
    ['/groups/12/debts', false],
    ['/expenses/new', false],
  ])('%s → %s', (path, expected) => {
    expect(isTopLevelPath(path)).toBe(expected)
  })
})
