import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import RegisterPage from './RegisterPage'
import ProtectedRoute from '../auth/ProtectedRoute'

// The auth client is task T021: mocked here so the page contract is defined
// first, with shapes styled by contracts/email-verification-api.md. Feature 003
// (task T014): a successful registration navigates to /check-email WITHOUT
// starting a session (FR-001); the screen itself is task T023.
vi.mock('../api/authClient', () => ({
  NETWORK_ERROR_MESSAGE: 'No se pudo completar el registro. Intenta nuevamente',
  register: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}))
const authClient = await import('../api/authClient')

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
  authClient.me.mockResolvedValue({ ok: false, status: 401 })
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

/** Reads the auth context to prove no session was populated (FR-001). */
function SessionProbe() {
  const { user } = useAuth()
  return <span data-testid="session-probe">{user ? 'con-sesion' : 'sin-sesion'}</span>
}

function setupApp() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/check-email"
            element={
              <div data-testid="check-email">
                Revisa tu correo
                <SessionProbe />
              </div>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <div data-testid="groups-page">Mis grupos</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function fillForm(user) {
  await user.type(screen.getByLabelText(/^Nombre \*/), 'Ana')
  await user.type(screen.getByLabelText(/^Correo electrónico \*/), 'ana.perez@example.com')
  await user.type(screen.getByLabelText(/^Contraseña \*/), 'Password123!')
  await user.type(screen.getByLabelText(/^Confirmar contraseña \*/), 'Password123!')
  await user.click(screen.getByLabelText(/Términos y Condiciones/i))
}

describe('RegisterPage (US1/US2 behaviors after feature 003)', () => {
  it('envío válido → navega a /check-email sin iniciar sesión (FR-001, SC-002)', async () => {
    const user = userEvent.setup()
    authClient.register.mockResolvedValue({ ok: true, email: 'ana.perez@example.com' })
    setupApp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByTestId('check-email')).toHaveTextContent('Revisa tu correo')
    // No session is started: the dashboard is never reached (FR-001/SC-002).
    expect(screen.getByTestId('session-probe')).toHaveTextContent('sin-sesion')
    expect(screen.queryByTestId('dashboard-email')).not.toBeInTheDocument()
    // The address is kept for the "Revisa tu correo" screen across reloads (FR-002).
    expect(sessionStorage.getItem('amano.check-email')).toBe('ana.perez@example.com')
  })

  it('409 → muestra el mensaje exacto y conserva lo completado (FR-018)', async () => {
    const user = userEvent.setup()
    authClient.register.mockResolvedValue({
      ok: false,
      status: 409,
      detail: 'El correo electrónico ya se encuentra registrado',
      fields: { email: 'El correo electrónico ya se encuentra registrado' },
    })
    setupApp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(
      await screen.findByText('El correo electrónico ya se encuentra registrado'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Correo electrónico \*/)).toHaveDisplayValue(
      'ana.perez@example.com',
    )
    expect(authClient.register).toHaveBeenCalledTimes(1)
  })

  it('fallo de red → mensaje fijo, datos intactos y botón rehabilitado (FR-019/FR-017)', async () => {
    const user = userEvent.setup()
    authClient.register.mockResolvedValue({ ok: false, network: true })
    setupApp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText("No se pudo completar el registro. Intenta nuevamente")).toBeInTheDocument()
    expect(screen.getByLabelText(/^Correo electrónico \*/)).toHaveDisplayValue(
      'ana.perez@example.com',
    )
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeEnabled()
  })

  it('400 sin properties.fields muestra el detail genérico (FR-018)', async () => {
    const user = userEvent.setup()
    authClient.register.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: {},
    })
    setupApp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(
      await screen.findByText('La solicitud contiene campos inválidos'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear cuenta/i })).toBeEnabled()
  })

  it('mientras se envía el botón está deshabilitado y solo hay una petición (FR-015)', async () => {
    const user = userEvent.setup()
    let releaseResponse
    authClient.register.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseResponse = () => resolve({ ok: false, network: true })
        }),
    )
    setupApp()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    const button = screen.getByRole('button', { name: /crear cuenta/i })
    expect(button).toBeDisabled()

    releaseResponse()
    expect(await screen.findByText("No se pudo completar el registro. Intenta nuevamente")).toBeInTheDocument()
    expect(button).toBeEnabled()
    expect(authClient.register).toHaveBeenCalledTimes(1)
  })
})
