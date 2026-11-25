import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { AppRoutes } from './App'
import { AuthProvider } from './auth/AuthContext'
import { INVALID_LINK_MESSAGE } from './pages/VerifyEmailPage'

// AuthProvider consulta /api/users/me al montar; en pruebas offline devuelve 401.
beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App (T015)', () => {
  it('renderiza la landing pública en / con las llamadas a la acción', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', {
        name: /compartí gastos sin fricción ni cuentas complicadas/i,
      }),
    ).toBeInTheDocument()

    const main = screen.getByRole('main')
    expect(
      within(main).getByRole('link', { name: /empezar gratis/i }),
    ).toHaveAttribute('href', '/register')
    expect(
      within(main).getByRole('link', { name: /iniciar sesión/i }),
    ).toHaveAttribute('href', '/login')
  })
})

describe('App / con sesión (specs/015-main-screen)', () => {
  const PROFILE = {
    id: 7,
    firstName: 'Ana',
    email: 'ana@example.com',
    currencies: [],
    hasCustomAvatar: false,
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(url === '/api/users/me' ? PROFILE : []),
        }),
      ),
    )
  })

  function renderAt(path) {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('muestra la pantalla principal y no la landing (FR-001)', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /empezar gratis/i })).not.toBeInTheDocument()
  })

  it('/dashboard redirige a la pantalla principal (FR-002)', async () => {
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Grupos' })).toBeInTheDocument()
  })

})

describe('App rutas (T005/T009, specs/002-user-profile)', () => {
    it('/profile sin sesión redirige al inicio de sesión (FR-008)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
    // FR-008: no hay destello de datos del perfil.
    expect(screen.queryByTestId('profile-email')).not.toBeInTheDocument()
  })

  it('/profile con sesión renderiza la pantalla de perfil (FR-001)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: 7,
            firstName: 'Ana',
            lastName: 'Pérez',
            email: 'ana.perez@example.com',
            currencies: [],
            cbuCvu: null,
            hasCustomAvatar: false,
          }),
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByRole('heading', { name: /mi perfil/i })).toBeInTheDocument()
  })
})

describe('App ruta de nuevo gasto (specs/007-register-expense, T028)', () => {
  it('/expenses/new sin sesión redirige al login (FR-001/FR-002)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/expenses/new']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })
})

describe('App rutas de verificación (T035, specs/003-email-verification)', () => {
  it('/verify-email sin token es una ruta pública que muestra el enlace inválido (FR-008)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/verify-email']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByText(INVALID_LINK_MESSAGE)).toBeInTheDocument()
  })

  it('/verify-email/expired es una ruta pública con la pantalla de vencido (FR-006)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/verify-email/expired']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /el enlace expiró/i }),
    ).toBeInTheDocument()
  })
})

describe('App rutas de edición de perfil (specs/005-edit-user-profile)', () => {
  const PERFIL_FIJO = {
    id: 7,
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana.perez@example.com',
    currencies: [],
    cbuCvu: null,
    hasCustomAvatar: false,
  }

  // Sin sesión, el gate de 005 FR-018 reutiliza la redirección de 004 (FR-011):
  // a /login, no a /register como en las features de registro.
  it('/profile/edit sin sesión redirige al login (FR-018 de 005)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/edit']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })

  it('/profile/edit con sesión renderiza la pantalla de edición con el correo deshabilitado (FR-001, FR-007 de 005)', async () => {
    // El gate y la pantalla consultan /api/users/me: la misma respuesta sirve
    // para ambos fetch (AuthProvider y me()).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(PERFIL_FIJO),
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/edit']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /modificar perfil/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
  })

  it('/profile/password sin sesión redirige al login (FR-018 de 005)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/password']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })

  it('/profile/password con sesión renderiza la pantalla de cambio de contraseña (US2 de 005)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(PERFIL_FIJO),
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/password']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /cambiar contraseña/i }),
    ).toBeInTheDocument()
  })
})


describe('App ruta del buscador (specs/008-user-search)', () => {
  it('/users/search sin sesión redirige al login y no muestra el buscador (FR-011)', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users/search']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Buscar usuarios' })).not.toBeInTheDocument()
  })

  it('/users/search con sesión muestra la pantalla de búsqueda (FR-001)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ id: 7, firstName: 'Ana', email: 'ana@example.com', currencies: [] }),
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/users/search']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Buscar usuarios' }),
    ).toBeInTheDocument()
  })
})

describe('rutas de gastos de grupo (017)', () => {
  const PERFIL = { id: 7, email: 'ana@example.com', firstName: 'Ana', lastName: 'López', currencies: [] }

  it.each(['/groups/3/expenses/new', '/groups/3/expenses/12', '/groups/3/expenses/12/debts/31/payment'])('%s sin sesión redirige al login', async (path) => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument()
  })

  it('/groups/:id/history con sesión pasa el id del grupo al historial', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(PERFIL) }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/groups/3/history?filter=EXPENSES']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Historial de actividad' })).toBeInTheDocument()
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/groups/3/activity'), expect.anything()),
    )
  })
})
