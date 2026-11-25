import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '../auth/AuthContext'
import ProtectedRoute from '../auth/ProtectedRoute'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Cambio de contraseña (specs/005-edit-user-profile US2, T013): exige
// acreditar la contraseña actual (FR-013/FR-014, clarificación 2026-10-20),
// aplica la política de 001 a la nueva (FR-006 de 001) con confirmación,
// mantiene la sesión tras el cambio (FR-013) y trata fallos de red sin
// limpiar el formulario (FR-019).
vi.mock('../api/authClient', () => ({
  UPDATE_NETWORK_ERROR_MESSAGE:
    'No se pudo completar la actualización. Intenta nuevamente',
  me: vi.fn(),
  updatePassword: vi.fn(),
}))

import { updatePassword } from '../api/authClient'
import ChangePasswordPage from './ChangePasswordPage'

beforeEach(() => {
  vi.unstubAllGlobals()
  updatePassword.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: 7,
          firstName: 'Ana',
          email: 'ana.perez@example.com',
          currencies: [],
          hasCustomAvatar: false,
        }),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// El Link de vuelta y useNavigate requieren un router en el árbol de render.
function renderPassword() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/profile/password']}>
        <ChangePasswordPage />
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function completar(user, { current = 'S3gura!2026', nueva = 'N3uva#Clave' } = {}) {
  await user.type(screen.getByLabelText('Contraseña actual'), current)
  await user.type(screen.getByLabelText('Nueva contraseña'), nueva)
  await user.type(screen.getByLabelText('Confirmar nueva contraseña'), nueva)
}

describe('ChangePasswordPage (US2)', () => {
  it('con la contraseña actual correcta concreta el cambio y confirma el éxito (FR-013)', async () => {
    const user = userEvent.setup()
    updatePassword.mockResolvedValue({
      ok: true,
      profile: { id: 7, firstName: 'Ana', email: 'ana.perez@example.com' },
    })
    renderPassword()

    await completar(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledTimes(1)
    })
    expect(updatePassword.mock.calls[0][0]).toEqual({
      currentPassword: 'S3gura!2026',
      newPassword: 'N3uva#Clave',
      confirmPassword: 'N3uva#Clave',
    })
    // Éxito visible; el formulario se limpia para una próxima operación.
    expect(await screen.findByRole('status')).toHaveTextContent(
      /la contraseña se cambió correctamente/i,
    )
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('')
  })

  it('acreditación incorrecta: mensaje específico en el campo y sin cambios (FR-014)', async () => {
    const user = userEvent.setup()
    updatePassword.mockResolvedValue({
      ok: false,
      status: 400,
      fields: { currentPassword: 'La contraseña actual no es correcta' },
    })
    renderPassword()

    await completar(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => {
      expect(updatePassword).toHaveBeenCalledTimes(1)
    })
    expect(screen.getAllByText(/la contraseña actual no es correcta/i).length)
      .toBeGreaterThan(0)
    // Los campos escritos se conservan para corregir.
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('N3uva#Clave')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('valida la política de 001 y la confirmación antes de enviar (FR-006 de 001)', async () => {
    const user = userEvent.setup()
    renderPassword()

    await user.type(screen.getByLabelText('Contraseña actual'), 'S3gura!2026')
    await user.type(screen.getByLabelText('Nueva contraseña'), 'corta')
    await user.click(screen.getByLabelText('Confirmar nueva contraseña'))

    expect(
      await screen.findByText(/la contraseña debe tener al menos 8 caracteres/i),
    ).toBeInTheDocument()
    // La política fallida en el cliente nunca llama al servidor.
    expect(updatePassword).not.toHaveBeenCalled()

    const nueva = screen.getByLabelText('Nueva contraseña')
    await user.clear(nueva)
    await user.type(nueva, 'N3uva#Clave')
    const confirmar = screen.getByLabelText('Confirmar nueva contraseña')
    await user.clear(confirmar)
    await user.type(confirmar, 'Otra#Distinta')
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText(/las contraseñas no coinciden/i)).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('fallo de red muestra el mensaje fijo conservando los datos (FR-019)', async () => {
    const user = userEvent.setup()
    updatePassword.mockResolvedValue({ ok: false, network: true })
    renderPassword()

    await completar(user)
    await user.click(screen.getByRole('button', { name: /^guardar$/i }))

    expect(await screen.findByText(/no se pudo completar la actualización/i))
      .toBeInTheDocument()
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('N3uva#Clave')
  })

  // El gate redirige a /login desde 004 (FR-011): era /register antes de que
  // existiera el login; 005 FR-018 hereda esa redirección al flujo de acceso.
  it('sin sesión, ProtectedRoute redirige al login (FR-018)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) }),
    )
    const LoginPage = (await import('./LoginPage')).default
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/password']}>
          <Routes>
            {/* Sin el gate, la página se renderizaría igual: acá se prueba el gate. */}
            <Route
              path="/profile/password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(
      await screen.findByRole('heading', { name: /iniciar sesión/i }),
    ).toBeInTheDocument()
  })
})

describe('ChangePasswordPage: navegación de vuelta', () => {
  function renderWithProfile() {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/profile/password']}>
          <Routes>
            <Route path="/profile/password" element={<ChangePasswordPage />} />
            <Route path="/profile" element={<p>Pantalla de perfil</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('muestra "← Mi perfil" arriba en lugar de "Volver a Mi perfil"', () => {
    renderWithProfile()

    expect(screen.getByRole('link', { name: /Mi perfil/ })).toHaveAttribute('href', '/profile')
    expect(screen.queryByText('Volver a Mi perfil')).not.toBeInTheDocument()
  })

  it('Cancelar, a la izquierda de Guardar, vuelve a Mi perfil sin llamar a la API', async () => {
    const user = userEvent.setup()
    renderWithProfile()

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const guardar = screen.getByRole('button', { name: /^guardar$/i })
    expect(cancelar.compareDocumentPosition(guardar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(cancelar)

    expect(await screen.findByText('Pantalla de perfil')).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })
})
