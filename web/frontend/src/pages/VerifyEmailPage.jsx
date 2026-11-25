import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { verifyEmail } from '../api/authClient'
import { useAuth } from '../auth/AuthContext'
import AuthPage from '../components/AuthPage'
import { useSnackbar } from '../components/Snackbar'

// Exact messages of the redemption contract (task T034; FR-006..FR-008).
// They are exported so the tests assert the same text the user sees.
export const INVALID_LINK_MESSAGE = 'El enlace de verificación no es válido'
export const USED_LINK_MESSAGE =
  'Este enlace de verificación ya ha sido utilizado. Por favor, inicia sesión'
export const VERIFIED_MESSAGE = 'Cuenta verificada'

// Verifies the email link (task T034, feature 003, FR-005..FR-009).
// The POST is fired once on mount with the token taken from the URL; on success
// the session store gets the profile and the user lands on the main screen,
// with a "Cuenta verificada" snackbar, and
// the URL cleaned (replace), so the token disappears from the address bar. A
// missing token is treated as invalid without calling the backend. The 410 sends
// the user to the expired screen, which leads to the resend flow (US4).
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const showSnackbar = useSnackbar()
  const [message, setMessage] = useState(null)
  const started = useRef(false)

  const token = searchParams.get('token')

  useEffect(() => {
    if (started.current) {
      return
    }
    started.current = true

    if (!token) {
      return
    }

    verifyEmail(token).then((result) => {
      if (result.ok) {
        setUser(result.profile)
        showSnackbar(VERIFIED_MESSAGE)
        navigate('/', { replace: true })
        return
      }
      if (result.status === 410) {
        navigate('/verify-email/expired', { replace: true })
        return
      }
      if (result.status === 409) {
        setMessage(USED_LINK_MESSAGE)
        return
      }
      setMessage(INVALID_LINK_MESSAGE)
    })
  }, [navigate, setUser, showSnackbar, token])

  // A missing token is invalid without calling the backend; the async outcomes
  // of the request above land in `message`.
  const displayedMessage = message ?? (token ? null : INVALID_LINK_MESSAGE)

  return (
    <AuthPage title="Verificando tu correo…">
      {displayedMessage && <p role="alert">{displayedMessage}</p>}
      <nav aria-label="Enlaces de verificación">
        <p>
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </nav>
    </AuthPage>
  )
}
