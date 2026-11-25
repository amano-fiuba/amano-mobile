import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'

// Perfil de solo lectura (tasks.md US1/US2/US3): los datos provienen
// únicamente del contrato de sesión GET /api/users/me vía me()
// (authClient). Contraseña enmascarada (FR-002), "No informado" en
// opcionales ausentes (FR-004), default ARS (FR-006), avatar default
// (FR-005), error de red sin datos ficticios (FR-009).
//
// se mockea el módulo del cliente (no el fetch global) para poder
// diferenciar el bootstrap de sesión (AuthProvider, fetch real stubbeado)
// de la consulta de la pantalla (me(), mock explícito): en React los
// efectos de los hijos corren antes que los del padre, así que el orden
// de los fetch globales no es determinista.
const PERFIL_COMPLETO = {
  id: 7,
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana.perez@example.com',
  currencies: ['ARS', 'USD'],
  cbuCvu: '0000003100010000000001',
  hasCustomAvatar: true,
  avatarUrl: '/api/users/7/avatar',
}

const PERFIL_MINIMO = {
  id: 7,
  firstName: 'Beto',
  lastName: null,
  email: 'beto@example.com',
  currencies: [],
  cbuCvu: null,
  hasCustomAvatar: false,
}

vi.mock('../api/authClient', () => ({
  me: vi.fn(),
}))

import { me } from '../api/authClient'
import ProfilePage from './ProfilePage'

beforeEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
  me.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function renderProfile() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<div>Pantalla de edición</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function stubSesion(perfil) {
  const response = {
    ok: perfil !== null,
    status: perfil === null ? 401 : 200,
    json: () => Promise.resolve(perfil),
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

describe('ProfilePage (US1: visualizar mi perfil)', () => {
  it('renderiza los datos completos con contraseña enmascarada (FR-002, FR-003)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderProfile()

    expect(await screen.findByRole('heading', { name: /mi perfil/i })).toBeInTheDocument()
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Ana')
    expect(screen.getByTestId('profile-email')).toHaveTextContent('ana.perez@example.com')
    // FR-002/SC-003: nunca texto claro ni valor real en el DOM.
    expect(screen.getByTestId('profile-password').textContent).not.toMatch(/s3gura/i)
    expect(screen.getByTestId('profile-password')).toHaveTextContent('●●●●●●●●')
    expect(
      screen.getByText(/por seguridad, la contraseña no se muestra/i),
    ).toBeInTheDocument()
    expect(screen.getByTestId('profile-lastname')).toHaveTextContent('Pérez')
    expect(screen.getByTestId('profile-cbu')).toHaveTextContent('0000003100010000000001')
    expect(screen.getByTestId('profile-currencies')).toHaveTextContent('ARS, USD')
    expect(screen.getByRole('img', { name: /avatar de ana/i })).toHaveAttribute(
      'src',
      '/api/users/7/avatar',
    )
  })

  it('copia el CBU/CVU propio desde la línea del perfil', async () => {
    const user = userEvent.setup()
    // Después de setup(): userEvent instala su propio navigator.clipboard.
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Copiar CBU/CVU' }))

    expect(writeText).toHaveBeenCalledWith(PERFIL_COMPLETO.cbuCvu)
    expect(await screen.findByText('¡Copiado!')).toBeInTheDocument()
    delete navigator.clipboard
  })

  it('muestra "No informado", ARS y avatar default en opcionales ausentes (FR-004, FR-005, FR-006)', async () => {
    stubSesion(PERFIL_MINIMO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_MINIMO })
    renderProfile()

    expect(await screen.findByTestId('profile-name')).toHaveTextContent('Beto')
    expect(screen.getByTestId('profile-lastname')).toHaveTextContent('No informado')
    expect(screen.getByTestId('profile-cbu')).toHaveTextContent('No informado')
    expect(screen.queryByRole('button', { name: 'Copiar CBU/CVU' })).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-currencies')).toHaveTextContent('ARS')
    expect(screen.getByRole('img', { name: /avatar de beto/i })).toHaveAttribute(
      'src',
      '/avatar-default.png',
    )
  })
})

describe('ProfilePage (US2: aislamiento de datos)', () => {
  it('solo muestra la información del usuario en sesión (FR-007)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderProfile()

    expect(await screen.findByTestId('profile-email')).toHaveTextContent('ana.perez@example.com')
    // Datos de otro usuario (B) jamás aparecen: no hay fuente de datos ajena.
    expect(screen.queryByText('Beto')).not.toBeInTheDocument()
    expect(screen.queryByText('beto@example.com')).not.toBeInTheDocument()
    expect(screen.queryByText('1111111111111111111111')).not.toBeInTheDocument()
  })
})

describe('ProfilePage (US3: estados de fallo)', () => {
  it('error de red muestra mensaje y no renderiza datos incompletos (FR-009)', async () => {
    // Sesión válida (bootstrap OK) + fallo de red en el refresco de me().
    stubSesion(PERFIL_COMPLETO)
    me.mockRejectedValue(new Error('network down'))
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo cargar el perfil/i,
    )
    expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument()
  })

  it('fallo de red señalado por el cliente (result.network) también muestra el mensaje (FR-009)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: false, network: true })
    renderProfile()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /no se pudo cargar el perfil/i,
    )
    expect(screen.queryByTestId('profile-name')).not.toBeInTheDocument()
  })

  it('401 del refresco no rompe el render: el gate de la ruta redirige (FR-008)', async () => {
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: false, status: 401 })
    renderProfile()

    expect(await screen.findByTestId('profile-name')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('al desmontar ignora la respuesta tardía de me() (limpieza del efecto)', async () => {
    stubSesion(PERFIL_COMPLETO)
    let resolveMe
    me.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve
        }),
    )
    const { unmount } = renderProfile()
    unmount()
    resolveMe({ ok: true, profile: PERFIL_COMPLETO })
    // Flush de microtareas: la respuesta tardía debe ignorarse sin actualizar estado.
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe('ProfilePage (005: entrada a la edición)', () => {
  it('"Modificar perfil" es alcanzable desde la visualización en ≤1 interacción (FR-001 de 005)', async () => {
    const user = userEvent.setup()
    stubSesion(PERFIL_COMPLETO)
    me.mockResolvedValue({ ok: true, profile: PERFIL_COMPLETO })
    renderProfile()

    expect(await screen.findByRole('heading', { name: /mi perfil/i })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /modificar perfil/i }))

    expect(await screen.findByText('Pantalla de edición')).toBeInTheDocument()
  })
})
