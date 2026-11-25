import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import LoginPage from './LoginPage'
import { BAD_CREDENTIALS_MESSAGE, UNVERIFIED_MESSAGE } from '../components/LoginForm'

// Login page (feature 004). The API client is mocked so each backend outcome is
// driven explicitly; AuthProvider's session check goes through the global fetch
// (401 = no session).
vi.mock('../api/authClient', () => ({
  LOGIN_NETWORK_ERROR_MESSAGE: 'No se pudo iniciar sesión. Intenta nuevamente',
  login: vi.fn(),
  resendVerification: vi.fn(),
}))

const authClient = await import('../api/authClient')

const PROFILE = { id: 7, firstName: 'Ana', email: 'ana@example.com', currencies: [] }

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
  authClient.login.mockReset()
  authClient.resendVerification.mockReset()
  sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

/** Shows whether the session store was populated. */
function SessionProbe({ label }) {
  const { user } = useAuth()
  return (
    <div>
      {label} {user ? `con-sesion:${user.firstName}` : 'sin-sesion'}
    </div>
  )
}

function renderLogin(initialEntries = ['/login']) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<SessionProbe label="DASHBOARD" />} />
          <Route path="/" element={<SessionProbe label="PRINCIPAL" />} />
          <Route path="/profile" element={<SessionProbe label="PERFIL" />} />
          <Route path="/register" element={<div>REGISTRO</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function fillAndSubmit(user, email, password) {
  await user.type(screen.getByLabelText('Correo electrónico'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))
}

describe('LoginPage (feature 004)', () => {
  it('muestra el formulario con la contraseña oculta y el enlace al registro', async () => {
    renderLogin()

    const heading = await screen.findByRole('heading', { name: /iniciar sesión/i })
    // Mismo contenedor/tarjeta que RegisterPage (`main.page`).
    expect(heading.closest('main')).toHaveClass('page')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('link', { name: /regístrate/i })).toHaveAttribute('href', '/register')
    expect(screen.getByText(/¿No tenés cuenta\?/)).toBeInTheDocument()
    // Feature 006: entry point to the password recovery request.
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('mientras se envía, el botón queda deshabilitado y muestra el progreso', async () => {
    let releaseResponse
    authClient.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseResponse = () => resolve({ ok: false, network: true })
        }),
    )
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    const button = screen.getByRole('button', { name: /iniciar sesión/i })
    await fillAndSubmit(user, 'ana@example.com', 'Password123!')

    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Ingresando…')
    expect(authClient.login).toHaveBeenCalledTimes(1)

    releaseResponse()
    expect(await screen.findByTestId('login-error')).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('campos vacíos: muestra los obligatorios y no llama al backend', async () => {
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }))

    expect(await screen.findByText('El correo electrónico es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument()
    expect(authClient.login).not.toHaveBeenCalled()
  })

  it('correo con formato inválido no se envía', async () => {
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'no-es-un-correo', 'Password123!')

    expect(await screen.findByText(/correo electrónico válido/i)).toBeInTheDocument()
    expect(authClient.login).not.toHaveBeenCalled()
  })

  it('200: guarda la sesión y navega a la pantalla principal con el correo normalizado', async () => {
    authClient.login.mockResolvedValue({ ok: true, profile: PROFILE })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, '  Ana@Example.COM ', 'Password123!')

    expect(await screen.findByText('PRINCIPAL con-sesion:Ana')).toBeInTheDocument()
    expect(authClient.login).toHaveBeenCalledWith('ana@example.com', 'Password123!')
  })

  it('200: vuelve a la ruta protegida que se intentó abrir (state.from)', async () => {
    authClient.login.mockResolvedValue({ ok: true, profile: PROFILE })
    const user = userEvent.setup()
    renderLogin([{ pathname: '/login', state: { from: { pathname: '/profile' } } }])
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'ana@example.com', 'Password123!')

    expect(await screen.findByText('PERFIL con-sesion:Ana')).toBeInTheDocument()
  })

  it('401: mensaje genérico, limpia la contraseña y conserva el correo', async () => {
    authClient.login.mockResolvedValue({
      ok: false,
      status: 401,
      detail: 'Necesitas iniciar sesión para continuar',
      fields: {},
      action: null,
    })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'ana@example.com', 'Incorrecta1!')

    expect(await screen.findByTestId('login-error')).toHaveTextContent(BAD_CREDENTIALS_MESSAGE)
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.com')
    expect(screen.queryByText(/DASHBOARD/)).not.toBeInTheDocument()
  })

  it('403 sin verificar: muestra el aviso y ofrece el reenvío al mismo correo', async () => {
    authClient.login.mockResolvedValue({
      ok: false,
      status: 403,
      detail: UNVERIFIED_MESSAGE,
      fields: {},
      action: 'RESEND_VERIFICATION',
    })
    authClient.resendVerification.mockResolvedValue({
      ok: true,
      message: 'Si el correo existe y no ha sido verificado, se enviará un nuevo enlace de confirmación',
      remainingSeconds: 300,
    })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'Ana@Example.com', 'Password123!')

    const notice = await screen.findByTestId('login-unverified')
    expect(notice).toHaveTextContent(UNVERIFIED_MESSAGE)

    await user.click(screen.getByRole('button', { name: /reenviar correo de verificación/i }))

    expect(authClient.resendVerification).toHaveBeenCalledWith('ana@example.com')
    expect(await screen.findByRole('timer')).toHaveTextContent('05:00')
  })

  it('400: muestra los mensajes por campo del servidor', async () => {
    authClient.login.mockResolvedValue({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { email: 'Mensaje del servidor para el correo' },
      action: null,
    })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'ana@example.com', 'x')

    expect(await screen.findByText('Mensaje del servidor para el correo')).toBeInTheDocument()
  })

  it('fallo de red: mensaje fijo y el botón vuelve a habilitarse', async () => {
    authClient.login.mockResolvedValue({ ok: false, network: true })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'ana@example.com', 'Password123!')

    expect(await screen.findByTestId('login-error')).toHaveTextContent(
      'No se pudo iniciar sesión. Intenta nuevamente',
    )
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeEnabled()
  })

  it('otro error con detalle muestra ese detalle', async () => {
    authClient.login.mockResolvedValue({
      ok: false,
      status: 429,
      detail: 'Demasiados intentos',
      fields: {},
      action: null,
    })
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole('heading', { name: /iniciar sesión/i })

    await fillAndSubmit(user, 'ana@example.com', 'Password123!')

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Demasiados intentos')
  })

  it('con sesión activa no muestra el formulario: va directo a la pantalla principal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(PROFILE) }),
    )
    renderLogin()

    expect(await screen.findByText('PRINCIPAL con-sesion:Ana')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /iniciar sesión/i })).not.toBeInTheDocument()
  })
})
