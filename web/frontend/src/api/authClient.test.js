import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE,
  LOGIN_NETWORK_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  RESET_PASSWORD_NETWORK_ERROR_MESSAGE,
  forgotPassword,
  login,
  logout,
  me,
  register,
  resendVerification,
  resetPassword,
} from './authClient'

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('register(endpoint: POST /api/auth/register, contracts/email-verification-api.md)', () => {
  // Feature 003 (task T013): the 201 body is {email} — no profile, no session cookie.
  it('201 devuelve ok con el correo normalizado (sin perfil)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: 'ana.perez@example.com' }),
      }),
    )

    const formData = new FormData()
    const result = await register(formData)

    expect(result).toEqual({ ok: true, email: 'ana.perez@example.com' })
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
  })

  it('4xx parsea el ProblemDetail (detail + properties.fields)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: 'La solicitud contiene campos inválidos',
            properties: { fields: { email: 'El correo...' } },
          }),
      }),
    )

    const result = await register(new FormData())

    expect(result).toEqual({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { email: 'El correo...' },
    })
  })

  it('409 sin properties devuelve detalle vacío y fields vacíos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ detail: 'El correo electrónico ya se encuentra registrado' }),
      }),
    )

    const result = await register(new FormData())

    expect(result).toEqual({
      ok: false,
      status: 409,
      detail: 'El correo electrónico ya se encuentra registrado',
      fields: {},
    })
  })

  it('5xx se tratata como fallo de red (FR-019)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    )

    const result = await register(new FormData())

    expect(result).toEqual({ ok: false, network: true })
  })

  it('fallo de red devuelve network:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await register(new FormData())

    expect(result).toEqual({ ok: false, network: true })
  })
})

describe('me(endpoint: GET /api/users/me, contracts/users-api.md)', () => {
  it('200 devuelve ok con el perfil', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 7, firstName: 'Ana' }),
      }),
    )

    const result = await me()

    expect(result).toEqual({ ok: true, profile: { id: 7, firstName: 'Ana' } })
    expect(fetch).toHaveBeenCalledWith('/api/users/me', { credentials: 'include' })
  })

  it('401 devuelve ok:false con el estado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    expect(await me()).toEqual({ ok: false, status: 401 })
  })

  it('fallo de red devuelve ok:false + network flag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await me()

    expect(result.ok).toBe(false)
    expect(result.network).toBe(true)
  })
})

describe('NETWORK_ERROR_MESSAGE (FR-019, contrato)', () => {
  it('es el mensaje fijo contratado', () => {
    expect(NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo completar el registro. Intenta nuevamente',
    )
  })
})

describe('resendVerification(endpoint: POST /api/auth/resend-verification, contracts)', () => {
  const NEUTRAL_MESSAGE =
    'Si el correo existe y no ha sido verificado, se enviará un nuevo enlace de confirmación'

  // Feature 003 (task T050): the 200 body is {message, remainingSeconds}.
  it('200 devuelve ok con el mensaje neutro y el tiempo restante', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: NEUTRAL_MESSAGE, remainingSeconds: 127 }),
      }),
    )

    const result = await resendVerification('ana.perez@example.com')

    expect(result).toEqual({ ok: true, message: NEUTRAL_MESSAGE, remainingSeconds: 127 })
    expect(fetch).toHaveBeenCalledWith('/api/auth/resend-verification', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana.perez@example.com' }),
    })
  })

  it('fallo de red devuelve ok:false + network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await resendVerification('ana@example.com')).toEqual({ ok: false, network: true })
  })
})

describe('login(endpoint: POST /api/auth/login)', () => {
  it('200 devuelve ok con el perfil y envía las credenciales como JSON con cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 7, firstName: 'Ana' }),
      }),
    )

    const result = await login('ana@example.com', 'Password123!')

    expect(result).toEqual({ ok: true, profile: { id: 7, firstName: 'Ana' } })
    expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com', password: 'Password123!' }),
    })
  })

  it('401 devuelve el detalle sin acción', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ title: 'No autorizado', detail: 'Credenciales inválidas' }),
      }),
    )

    expect(await login('ana@example.com', 'mala')).toEqual({
      ok: false,
      status: 401,
      detail: 'Credenciales inválidas',
      fields: {},
      action: null,
    })
  })

  it('403 expone la acción RESEND_VERIFICATION', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            detail: 'Tu cuenta aún no ha sido verificada. Por favor, revisa tu correo electrónico',
            properties: { action: 'RESEND_VERIFICATION' },
          }),
      }),
    )

    const result = await login('ana@example.com', 'Password123!')

    expect(result.status).toBe(403)
    expect(result.action).toBe('RESEND_VERIFICATION')
  })

  it('4xx con cuerpo no JSON no rompe', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.reject(new Error('no json')),
      }),
    )

    expect(await login('a@b.co', 'x')).toEqual({
      ok: false,
      status: 401,
      detail: '',
      fields: {},
      action: null,
    })
  })

  it('5xx y fallo de red se tratan como network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    expect(await login('a@b.co', 'x')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await login('a@b.co', 'x')).toEqual({ ok: false, network: true })
  })

  it('LOGIN_NETWORK_ERROR_MESSAGE es el mensaje fijo del login', () => {
    expect(LOGIN_NETWORK_ERROR_MESSAGE).toBe('No se pudo iniciar sesión. Intenta nuevamente')
  })
})

describe('logout(endpoint: POST /api/auth/logout)', () => {
  it('204 devuelve ok y envía la cookie', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))

    expect(await logout()).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  })

  it('fallo de red no lanza', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    expect(await logout()).toEqual({ ok: false, network: true })
  })
})

describe('forgotPassword(endpoint: POST /api/auth/forgot-password, feature 006)', () => {
  const NEUTRAL_MESSAGE =
    'Si el correo existe, recibirás un enlace para restablecer tu contraseña'

  it('200 devuelve ok con el mensaje neutro y envía el correo como JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: NEUTRAL_MESSAGE }),
      }),
    )

    expect(await forgotPassword('ana@example.com')).toEqual({ ok: true, message: NEUTRAL_MESSAGE })
    expect(fetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ana@example.com' }),
    })
  })

  it('5xx y fallo de red se tratan como network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    expect(await forgotPassword('a@b.co')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await forgotPassword('a@b.co')).toEqual({ ok: false, network: true })
  })

  it('FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE es el mensaje fijo', () => {
    expect(FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo enviar la solicitud. Intenta nuevamente',
    )
  })
})

describe('resetPassword(endpoint: POST /api/auth/reset-password, feature 006)', () => {
  const SUCCESS = 'Tu contraseña fue actualizada. Ya puedes iniciar sesión'

  it('200 devuelve ok con el mensaje y envía token y contraseñas como JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ message: SUCCESS }) }),
    )

    expect(await resetPassword('tok', 'Clave123!', 'Clave123!')).toEqual({
      ok: true,
      message: SUCCESS,
    })
    expect(fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok', password: 'Clave123!', confirmPassword: 'Clave123!' }),
    })
  })

  it('4xx devuelve status, detail y campos del ProblemDetail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            detail: 'La solicitud contiene campos inválidos',
            properties: { fields: { password: 'Muy corta' } },
          }),
      }),
    )

    expect(await resetPassword('tok', 'x', 'x')).toEqual({
      ok: false,
      status: 400,
      detail: 'La solicitud contiene campos inválidos',
      fields: { password: 'Muy corta' },
    })
  })

  it('5xx y fallo de red se tratan como network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    expect(await resetPassword('tok', 'x', 'x')).toEqual({ ok: false, network: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await resetPassword('tok', 'x', 'x')).toEqual({ ok: false, network: true })
  })

  it('RESET_PASSWORD_NETWORK_ERROR_MESSAGE es el mensaje fijo', () => {
    expect(RESET_PASSWORD_NETWORK_ERROR_MESSAGE).toBe(
      'No se pudo actualizar la contraseña. Intenta nuevamente',
    )
  })
})
