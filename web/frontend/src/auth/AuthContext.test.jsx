import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { user, loading } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.firstName : 'sin sesión'}</span>
    </div>
  )
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AuthProvider (T015, FR-016)', () => {
  it('consulta GET /api/users/me con credentials include y expone la sesión', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: 1, firstName: 'Ana', email: 'ana.perez@example.com' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByTestId('user')).toHaveTextContent('Ana')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me', { credentials: 'include' })
  })

  it('sin sesión (401) no expone usuario y deja de cargar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByTestId('user')).toHaveTextContent('sin sesión')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('fallo de red también deja el estado sin usuario (loading false)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByTestId('user')).toHaveTextContent('sin sesión')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })
})
