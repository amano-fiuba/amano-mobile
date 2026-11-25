import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ExpiredLinkPage from './ExpiredLinkPage'
import { NEUTRAL_MESSAGE } from '../components/resendCountdown'

// Expired-link screen (task T030 + T053, TDD: the wiring arrived in US4):
// FR-006 — explains that the link expired and offers the resend flow, where the
// user types the address and submitting it fires the resend and shows the
// neutral message plus the countdown dictated by the server (FR-012/FR-013).
afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function renderPage() {
  render(
    <MemoryRouter>
      <ExpiredLinkPage />
    </MemoryRouter>,
  )
}

describe('ExpiredLinkPage (T030/T053)', () => {
  it('explica que el enlace expiró y ofrece el formulario de reenvío (FR-006)', () => {
    renderPage()

    const heading = screen.getByRole('heading', { name: /el enlace expiró/i })
    expect(heading.closest('main')).toHaveClass('page')
    expect(screen.getByText(/enlace de verificación ha expirado/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /enviar correo de verificación/i }),
    ).toBeEnabled()
    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('al enviar el correo dispara el reenvío neutro y muestra la cuenta regresiva (FR-012/T053)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: NEUTRAL_MESSAGE, remainingSeconds: 300 }),
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText(/correo electrónico/i), 'ana.perez@example.com')
    await user.click(screen.getByRole('button', { name: /enviar correo de verificación/i }))

    expect(await screen.findByText(NEUTRAL_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('05:00')
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/resend-verification',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'ana.perez@example.com' }),
      }),
    )
  })
})
