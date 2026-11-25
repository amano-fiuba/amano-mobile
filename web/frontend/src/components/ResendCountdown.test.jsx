import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ResendCountdown from './ResendCountdown'
import {
  NEUTRAL_MESSAGE,
  RESEND_LABEL,
  deadlineKey,
  formatCountdown,
} from './resendCountdown'

// Resend control contract (task T045, TDD: written BEFORE the implementation):
// FR-010 — the button is ALWAYS enabled and a click shows the neutral message
// plus a 5-minute countdown built from the server's remainingSeconds (source of
// truth); FR-013/SC-006 — during an active term nothing is sent and the
// countdown is restored from the sessionStorage deadline after a reload.
//
// The clock is faked (the countdown ticks), so clicks use fireEvent: RTL wraps
// it in act and it needs no timers, unlike user-event.
beforeEach(() => {
  vi.useFakeTimers()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

function stubResend({ remainingSeconds = 300, message = NEUTRAL_MESSAGE } = {}) {
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

describe('ResendCountdown (T045)', () => {
  it('el botón está habilitado al montar y no hay cuenta regresiva (FR-010)', () => {
    render(<ResendCountdown email="ana@example.com" />)

    expect(screen.getByRole('button', { name: RESEND_LABEL })).toBeEnabled()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('tras un clic muestra el mensaje neutro y arranca la cuenta regresiva del servidor (FR-010/FR-012)', async () => {
    stubResend({ remainingSeconds: 300 })

    render(<ResendCountdown email="ana@example.com" />)
    await clickResend()

    expect(screen.getByText(NEUTRAL_MESSAGE)).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(300)) // 05:00

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(299)) // 04:59
    expect(screen.getByRole('button', { name: RESEND_LABEL })).toBeEnabled()
  })

  it('al recargar durante el límite restaura la cuenta regresiva sin enviar nada (FR-013/SC-006)', () => {
    sessionStorage.setItem(deadlineKey('ana@example.com'), String(Date.now() + 120_000))
    stubResend()

    render(<ResendCountdown email="ana@example.com" />)

    expect(screen.getByRole('button', { name: RESEND_LABEL })).toBeEnabled()
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(120)) // 02:00
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('un clic durante el límite refleja el tiempo restante que devuelve el servidor (FR-013)', async () => {
    sessionStorage.setItem(deadlineKey('ana@example.com'), String(Date.now() + 250_000))
    stubResend({ remainingSeconds: 150 })

    render(<ResendCountdown email="ana@example.com" />)
    await clickResend()

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('timer')).toHaveTextContent(formatCountdown(150)) // 02:30
    expect(screen.getByText(NEUTRAL_MESSAGE)).toBeInTheDocument()
  })
})
