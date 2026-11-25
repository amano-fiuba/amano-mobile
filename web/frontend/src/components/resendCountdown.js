// State helpers and hook of the resend control (feature 003, tasks T051/T053,
// US4). The pure helpers are kept out of ResendCountdown.jsx so that file only
// exports a component (react-refresh) and so the tests can assert the
// persistence rules directly. The deadline — not a decrementing counter — is the
// single source of truth: the server returns the real remainingSeconds
// (FR-010/FR-013) and the deadline it produces is persisted per address so a
// reload restores the exact same countdown (SC-006).
import { useCallback, useEffect, useState } from 'react'

import { resendVerification } from '../api/authClient'

/** FR-012/SC-005: the neutral answer, identical in every case. */
export const NEUTRAL_MESSAGE =
  'Si el correo existe y no ha sido verificado, se enviará un nuevo enlace de confirmación'

/** The label of the resend button (FR-010: always present and enabled). */
export const RESEND_LABEL = 'Reenviar correo de verificación'

/** sessionStorage key of the countdown deadline, scoped per address (SC-006). */
export function deadlineKey(email) {
  return `amano.resend-deadline:${email ?? ''}`
}

/** Milliseconds deadline persisted for the address, or null when there is none. */
export function readDeadline(email) {
  const raw = sessionStorage.getItem(deadlineKey(email))
  if (raw == null) {
    return null
  }
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function persistDeadline(email, deadline) {
  sessionStorage.setItem(deadlineKey(email), String(deadline))
}

export function clearDeadline(email) {
  sessionStorage.removeItem(deadlineKey(email))
}

/** Whole seconds left until the deadline (ceil), never negative. */
export function remainingSecondsUntil(deadline, now = Date.now()) {
  if (deadline == null) {
    return 0
  }
  const diff = deadline - now
  return diff <= 0 ? 0 : Math.ceil(diff / 1000)
}

/** mm:ss of the remaining seconds, for the visible countdown. */
export function formatCountdown(seconds) {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/**
 * Resend state of one address: `resend()` asks the server, which answers the
 * neutral message plus its remainingSeconds (the source of truth), and the
 * `remaining` countdown ticks down from the persisted deadline. Shared by the
 * "Revisa tu correo" button and the expired-link form (T052/T053).
 */
export function useResendCountdown(email) {
  const [deadline, setDeadline] = useState(() => readDeadline(email))
  const [now, setNow] = useState(() => Date.now())
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (deadline == null) {
      return undefined
    }
    const tick = () => {
      if (remainingSecondsUntil(deadline, Date.now()) <= 0) {
        // The term expired: forget the persisted deadline so a reload starts clean.
        clearDeadline(email)
        setDeadline(null)
      } else {
        setNow(Date.now())
      }
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline, email])

  const remaining = remainingSecondsUntil(deadline, now)

  const resend = useCallback(async () => {
    const result = await resendVerification(email)
    if (!result.ok) {
      return result
    }
    const next = Date.now() + result.remainingSeconds * 1000
    persistDeadline(email, next)
    setDeadline(next)
    setNow(Date.now())
    setMessage(result.message ?? NEUTRAL_MESSAGE)
    return result
  }, [email])

  return { remaining, message, resend }
}
