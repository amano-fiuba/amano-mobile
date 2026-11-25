import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import CheckEmailPage, { CHECK_EMAIL_STORAGE_KEY } from './CheckEmailPage'

// "Revisa tu correo" contract (task T023, feature 003): FR-002 (the address is
// restored from sessionStorage, so a reload keeps showing it) and FR-010 (the
// resend button is always available; its request lands in US4).
afterEach(() => {
  sessionStorage.clear()
})

describe('CheckEmailPage (T023)', () => {
  it('muestra la dirección guardada y el botón de reenvío habilitado (FR-002/FR-010)', () => {
    sessionStorage.setItem(CHECK_EMAIL_STORAGE_KEY, 'ana.perez@example.com')

    render(
      <MemoryRouter>
        <CheckEmailPage />
      </MemoryRouter>,
    )

    const heading = screen.getByRole('heading', { name: 'Revisa tu correo' })
    expect(heading.closest('main')).toHaveClass('page')
    expect(screen.getByText(/ana\.perez@example\.com/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(
      screen.getByRole('button', { name: /reenviar correo de verificación/i }),
    ).toBeEnabled()
  })

  it('sin dirección guardada muestra el mensaje genérico y no rompe', () => {
    render(
      <MemoryRouter>
        <CheckEmailPage />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Enviamos un enlace de verificación a tu correo electrónico/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /reenviar correo de verificación/i }),
    ).toBeEnabled()
  })
})
