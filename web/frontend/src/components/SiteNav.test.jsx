import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SiteNav from './SiteNav'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({ useAuth }))
vi.mock('../api/friendsClient', () => ({
  FRIEND_REQUESTS_CHANGED_EVENT: 'changed',
  listReceivedFriendshipRequests: () => Promise.resolve({ ok: true, requests: [] }),
}))

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, loading: false })
})

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

function renderNav(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SiteNav />
    </MemoryRouter>,
  )
}

describe('SiteNav', () => {
  it('muestra la marca y los accesos públicos para visitantes', () => {
    renderNav()

    expect(
      screen.getByRole('link', { name: /a mano, ir al inicio/i }),
    ).toHaveAttribute('href', '/')
    expect(
      screen.getByRole('navigation', { name: 'Navegación principal' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /cambiar a modo (claro|oscuro)/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^modo (claro|oscuro)$/i)).not.toBeInTheDocument()
  })

  it('con sesión muestra la barra de la app y no los accesos públicos (015, FR-003)', () => {
    useAuth.mockReturnValue({ user: { id: 7 }, loading: false })
    renderNav()

    expect(
      screen.getByRole('link', { name: /a mano, ir al inicio/i }),
    ).toHaveAttribute('href', '/')
    expect(screen.getByRole('searchbox', { name: 'Buscar personas y grupos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/profile')
    expect(screen.getByRole('link', { name: 'Mis grupos' })).toHaveAttribute('href', '/groups')
    expect(screen.getByRole('link', { name: 'Actividad personal' })).toHaveAttribute('href', '/activity')
    expect(screen.getByRole('link', { name: 'Estadísticas' })).toHaveAttribute('href', '/statistics')
    expect(screen.getByRole('link', { name: 'Amigos' })).toHaveAttribute('href', '/friends')
    expect(screen.getByRole('button', { name: 'Notificaciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Registrarse' })).not.toBeInTheDocument()
  })

  it('el ícono de tema cambia entre modo oscuro y claro', async () => {
    useAuth.mockReturnValue({ user: { id: 7 }, loading: false })
    renderNav()

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      screen.getByRole('button', { name: 'Cambiar a modo claro' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('muestra la foto de perfil en el acceso a Mi perfil', () => {
    useAuth.mockReturnValue({
      user: { id: 7, hasCustomAvatar: true, avatarUrl: '/api/users/7/avatar?v=3' },
      loading: false,
    })
    renderNav()

    expect(
      screen.getByRole('link', { name: 'Mi perfil' }).querySelector('img'),
    ).toHaveAttribute('src', '/api/users/7/avatar?v=3')
  })

  it('sin foto propia usa el avatar por defecto', () => {
    useAuth.mockReturnValue({ user: { id: 7, hasCustomAvatar: false }, loading: false })
    renderNav()

    expect(
      screen.getByRole('link', { name: 'Mi perfil' }).querySelector('img'),
    ).toHaveAttribute('src', '/avatar-default.png')
  })

  it('resalta el acceso de la ruta actual', () => {
    useAuth.mockReturnValue({ user: { id: 7 }, loading: false })
    renderNav('/friends')

    expect(screen.getByRole('link', { name: 'Amigos' })).toHaveClass('is-active')
    expect(screen.getByRole('link', { name: 'Mi perfil' })).not.toHaveClass('is-active')
  })

  it('resalta el inicio en la landing pública', () => {
    renderNav('/')

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveClass('is-active')
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).not.toHaveClass(
      'is-active',
    )
  })
})
