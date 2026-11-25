import { useEffect } from 'react'
import { RESEND_LABEL, formatCountdown, useResendCountdown } from './resendCountdown'

// Resend control (task T051, feature 003, US4). The button is ALWAYS enabled
// (FR-010): a click during an active term is not blocked client-side — the
// server answers the neutral message with the real remaining time and sends
// nothing (FR-013/SC-005). The countdown is derived from the deadline the server
// dictated (5 min) and that deadline is persisted per address, so a reload keeps
// showing the same countdown without any request (SC-006).
//
// `autoResend` is used by the expired-link form (T053): submitting the address
// already is the user's request, so the first send fires on mount.
export default function ResendCountdown({ email, autoResend = false }) {
  const { remaining, message, resend } = useResendCountdown(email)

  useEffect(() => {
    if (autoResend) {
      resend()
    }
  }, [autoResend, resend])

  return (
    <div>
      <button type="button" onClick={resend}>
        {RESEND_LABEL}
      </button>
      {message && (
        <p role="status" className="form-success">
          {message}
        </p>
      )}
      {remaining > 0 && (
        <p role="timer">Podrás solicitar otro correo en {formatCountdown(remaining)}</p>
      )}
    </div>
  )
}
