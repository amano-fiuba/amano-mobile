import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CheckEmailPage, { CHECK_EMAIL_STORAGE_KEY } from './CheckEmailPage'
import {
  NEUTRAL_MESSAGE,
  RESEND_LABEL,
  deadlineKey,
  formatCountdown,
} from '../components/resendCountdown'

// "Revisa tu correo" resend flow (task T046, TDD: written BEFORE the
// implementation, completes T023/T052): FR-012 — a click shows the neutral
// message; FR-013/SC-006 — a reload during the term restores the countdown
// without sending and the server remains the source of truth for the remaining
// time. Clicks use fireEvent because the clock is faked for the countdown.
beforeEach(() => {
  vi.useFakeTimers()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function stubResend(remainingSeconds, message = NEUTRAL_MESSAGE) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message, remainingSeconds }),
    }),
  )
}

async function clickResend() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: RESEND_LABEL }))
  })
}

describe('CheckEmailPage resend (T046)', () => {
  it('un clic muestra el mensaje neutro y la cuenta regresiva (FR-012)', async () => {
    sessionStorage.setItem(CHECK_EMAIL_STORAGE_KEY, 'ana.perez@example.com')
    stubResend(300)

    render(
      <MemoryRouter>
        <CheckEmailPage />
      </MemoryRouter>,
    )
    await clickResend()

    expect(screen.getByText(NEUTRAL_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(300)) // 05:00
  })

  it('tras recargar durante el límite muestra el tiempo restante del servidor sin enviar (FR-013/SC-006)', async () => {
    sessionStorage.setItem(CHECK_EMAIL_STORAGE_KEY, 'ana@example.com')
    sessionStorage.setItem(deadlineKey('ana@example.com'), String(Date.now() + 200_000))
    stubResend(150)

    render(
      <MemoryRouter>
        <CheckEmailPage />
      </MemoryRouter>,
    )

    // The reload restored the countdown from sessionStorage: no request was made.
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(200)) // 03:20
    expect(globalThis.fetch).not.toHaveBeenCalled()

    // A new click asks the server, which is the source of truth for the remaining time.
    await clickResend()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(150)) // 02:30
    expect(screen.getByText(NEUTRAL_MESSAGE)).toBeInTheDocument()
  })
})
