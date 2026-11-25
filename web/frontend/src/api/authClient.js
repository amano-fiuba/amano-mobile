// API client for the auth endpoints (task T021, contracts/auth-api.md).
// Sends/receives the HttpOnly session cookie via credentials: 'include'.

// FR-019: fixed message for network failures or 5xx responses (US2 covers the
// live behavior; far endpoints of this feature reuse it).
import { apiUrl } from './apiBase'
import { forgetPushDevice } from '../mobile/nativePush'

export const NETWORK_ERROR_MESSAGE =
  'No se pudo completar el registro. Intenta nuevamente'

/** RFC 7807 shape: { detail, properties: { fields } } (auth-api "Errores"). */
async function parseProblem(response) {
  try {
    const problem = await response.json()
    return {
      detail: problem.detail ?? '',
      fields: problem.properties?.fields ?? {},
    }
  } catch {
    return { detail: '', fields: {} }
  }
}

/**
 * Single atomic multipart submit of the registration form.
 * Returns { ok: true, email } on 201 (feature 003: no profile, no session),
 * otherwise { ok: false, status, detail, fields } or { ok: false, network: true }.
 */
export async function register(formData) {
  try {
    const response = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, email: body.email }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, ...problem }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Redeems a verification token (feature 003, POST /api/auth/verify-email).
 * Returns { ok: true, profile } on 200 — the backend also sets the session
 * cookie, so the SPA only has to store the profile. 4xx come back as
 * { ok: false, status, detail } (400 invalid, 409 already used, 410 expired);
 * network failures and 5xx as { ok: false, network: true }.
 */
export async function verifyEmail(token) {
  try {
    const response = await fetch(apiUrl('/api/auth/verify-email'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (response.ok) {
      return { ok: true, profile: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, ...problem }
  } catch {
    return { ok: false, network: true }
  }
}

/** GET /api/users/me with the session cookie; { ok, profile } or { ok: false }. */
export async function me() {
  try {
    const response = await fetch(apiUrl('/api/users/me'), { credentials: 'include' })
    if (!response.ok) {
      return { ok: false, status: response.status }
    }
    return { ok: true, profile: await response.json() }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Requests a new verification email (feature 003, POST /api/auth/resend-verification).
 * The endpoint is always 200 with the neutral message and the remaining seconds of
 * the 5-minute limit (FR-012/SC-005), so a 4xx never carries domain meaning: only
 * network failures and 5xx come back as { ok: false, network: true }.
 */
export async function resendVerification(email) {
  try {
    const response = await fetch(apiUrl('/api/auth/resend-verification'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, message: body.message, remainingSeconds: body.remainingSeconds }
    }
    return { ok: false, network: response.status >= 500 }
  } catch {
    return { ok: false, network: true }
  }
}

// Feature 004 (login): fixed message for network failures or 5xx on login.
export const LOGIN_NETWORK_ERROR_MESSAGE =
  'No se pudo iniciar sesión. Intenta nuevamente'

/**
 * Logs in (POST /api/auth/login). Returns { ok: true, profile } on 200 — the
 * backend also sets the HttpOnly session cookie, so the SPA only stores the
 * profile. 4xx come back as { ok: false, status, detail, fields, action }
 * (401 bad credentials, 403 unverified account with action
 * 'RESEND_VERIFICATION'); network failures and 5xx as { ok: false, network: true }.
 */
export async function login(email, password) {
  try {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (response.ok) {
      return { ok: true, profile: await response.json() }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    let problem = {}
    try {
      problem = await response.json()
    } catch {
      problem = {}
    }
    return {
      ok: false,
      status: response.status,
      detail: problem.detail ?? '',
      fields: problem.properties?.fields ?? {},
      action: problem.properties?.action ?? null,
    }
  } catch {
    return { ok: false, network: true }
  }
}

// Feature 006 (password recovery): fixed message for network failures or 5xx.
export const FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE =
  'No se pudo enviar la solicitud. Intenta nuevamente'

/**
 * Requests a password reset link (feature 006, POST /api/auth/forgot-password).
 * The endpoint is always 200 with the same neutral message whether the account
 * exists or not (FR-002), so a 4xx never carries domain meaning: anything other
 * than 200 comes back as { ok: false, network: true }.
 */
export async function forgotPassword(email) {
  try {
    const response = await fetch(apiUrl('/api/auth/forgot-password'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, message: body.message }
    }
    return { ok: false, network: true }
  } catch {
    return { ok: false, network: true }
  }
}

// Feature 006 (US2): fixed message for network failures or 5xx on the reset.
export const RESET_PASSWORD_NETWORK_ERROR_MESSAGE =
  'No se pudo actualizar la contraseña. Intenta nuevamente'

/**
 * Redeems a reset link with the new password (feature 006, POST
 * /api/auth/reset-password). Returns { ok: true, message } on 200 — no session is
 * opened, the user logs in afterwards. 4xx come back as
 * { ok: false, status, detail, fields } (400 invalid link or per-field errors,
 * 410 expired link); network failures and 5xx as { ok: false, network: true }.
 */
export async function resetPassword(token, password, confirmPassword) {
  try {
    const response = await fetch(apiUrl('/api/auth/reset-password'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, confirmPassword }),
    })
    if (response.ok) {
      const body = await response.json()
      return { ok: true, message: body.message }
    }
    if (response.status >= 500) {
      return { ok: false, network: true }
    }
    const problem = await parseProblem(response)
    return { ok: false, status: response.status, ...problem }
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * Logs out (POST /api/auth/logout): the backend expires the HttpOnly cookie,
 * which the SPA cannot delete itself. Always resolves; the caller clears the
 * session store whatever the outcome.
 */
export async function logout() {
  try {
    // App Android (mobile 002): este teléfono deja de recibir notificaciones de la
    // cuenta. Va antes del logout porque necesita la sesión; en la web no hace nada.
    await forgetPushDevice().catch(() => {})
    const response = await fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    })
    return { ok: response.ok }
  } catch {
    return { ok: false, network: true }
  }
}

// ---------------------------------------------------------------------------
// Edición del perfil (specs/005-edit-user-profile, contracts/users-api.md).
// Conventions shared with the 001 client: { ok: true, profile } on success
// (the server answers the FRESH public representation), { ok: false, status,
// fields, detail } per contract failures and { ok: false, network: true } for
// network failures / 5xx. A 401 never carries domain meaning: the caller lets
// the ProtectedRoute gate of the route redirect.
// FR-019: fixed message for network failures or 5xx on these mutations.
// ---------------------------------------------------------------------------

export const UPDATE_NETWORK_ERROR_MESSAGE =
  'No se pudo completar la actualización. Intenta nuevamente'

/** PUT /api/users/me (US1): names, lastName, cbuCvu, currencies. NEVER the email. */
export async function updateProfile(payload) {
  try {
    const response = await fetch(apiUrl('/api/users/me'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, profile: await response.json() }
    }
    return await parseProblemOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** PUT /api/users/me/password (US2): current credit + policy-compliant new one. */
export async function updatePassword(payload) {
  try {
    const response = await fetch(apiUrl('/api/users/me/password'), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      return { ok: true, profile: await response.json() }
    }
    return await parseProblemOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

/**
 * PUT /api/users/me/avatar (US3): replaces (or creates first) the own binary.
 * The server validates the REAL content again (magic bytes + 2 MB, D6).
 */
export async function updateAvatar(file) {
  try {
    const body = new FormData()
    body.append('avatar', file, file.name)
    const response = await fetch(apiUrl('/api/users/me/avatar'), {
      method: 'PUT',
      credentials: 'include',
      body,
    })
    if (response.ok) {
      return { ok: true, profile: await response.json() }
    }
    return await parseProblemOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** DELETE /api/users/me/avatar (US3): back to the default representation; 204. */
export async function deleteAvatar() {
  try {
    const response = await fetch(apiUrl('/api/users/me/avatar'), {
      method: 'DELETE',
      credentials: 'include',
    })
    if (response.ok) {
      return { ok: true } // 204 sin cuerpo
    }
    return await parseProblemOf(response)
  } catch {
    return { ok: false, network: true }
  }
}

/** Shared 4xx mapping for the mutation endpoints (parseProblem + status). */
async function parseProblemOf(response) {
  if (response.status === 401) {
    return { ok: false, status: 401 }
  }
  if (response.status >= 500) {
    return { ok: false, network: true }
  }
  const problem = await parseProblem(response)
  return { ok: false, status: response.status, ...problem }
}
