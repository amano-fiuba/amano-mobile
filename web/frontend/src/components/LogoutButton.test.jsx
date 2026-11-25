import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LogoutButton from './LogoutButton'

const { setUser } = vi.hoisted(() => ({ setUser: vi.fn() }))

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('../api/authClient', () => ({ logout }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ setUser }) }))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

beforeEach(() => {
  setUser.mockClear()
  logout.mockReset()
})

describe('LogoutButton', () => {
  it('al confirmar: logout, limpia la sesión y vuelve al login', async () => {
    logout.mockResolvedValue({ ok: true })

    render(
      <MemoryRouter initialEntries={['/groups']}>
        <LogoutButton />
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login')
    })
    expect(logout).toHaveBeenCalledTimes(1)
    expect(setUser).toHaveBeenCalledWith(null)
  })

  it('aunque el backend falle, la sesión local se limpia y vuelve al login', async () => {
    logout.mockRejectedValue(new Error('network'))

    render(
      <MemoryRouter initialEntries={['/groups']}>
        <LogoutButton />
        <Routes>
          <Route path="/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login')
    })
    expect(setUser).toHaveBeenCalledWith(null)
  })
})
