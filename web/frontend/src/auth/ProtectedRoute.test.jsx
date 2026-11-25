import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './AuthContext'
import ProtectedRoute from './ProtectedRoute'

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function setupRouting(fetchMock) {
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>ir al login</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>dashboard contenido</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute (T015, SC-002)', () => {
    it('sin sesión redirige a /login', async () => {
    setupRouting(vi.fn().mockResolvedValue({ ok: false, status: 401 }))

    expect(await screen.findByText('ir al login')).toBeInTheDocument()
  })

  it('con sesión activa renderiza el contenido protegido', async () => {
    setupRouting(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, firstName: 'Ana' }),
      }),
    )

    expect(await screen.findByText('dashboard contenido')).toBeInTheDocument()
  })
})
