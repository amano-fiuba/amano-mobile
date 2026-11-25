import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  PASSWORD_REQUIREMENTS,
  validateConfirmPassword,
  validatePassword,
} from '../validation/registerValidation'
import { RESET_PASSWORD_NETWORK_ERROR_MESSAGE, resetPassword } from '../api/authClient'
import AuthPage from '../components/AuthPage'
import { useSnackbar } from '../components/Snackbar'
import SubmitButton from '../components/SubmitButton'
import TextField from '../components/TextField'

// Exact messages of the redemption contract (feature 006, FR-012/FR-013/FR-015),
// exported so the tests assert the same text the user sees.
export const INVALID_RESET_LINK_MESSAGE = 'El enlace para restablecer la contraseña no es válido'
export const EXPIRED_RESET_LINK_MESSAGE = 'El enlace para restablecer la contraseña ha expirado'
export const RESET_SUCCESS_MESSAGE = 'Tu contraseña fue actualizada. Ya puedes iniciar sesión'

// New password screen (feature 006, US2). The token comes from the emailed link
// (?token=...); a missing one is invalid without calling the backend. Outcomes of
// resetPassword():
//  - 200 → /login with the success notice (no session is opened)
//  - 410 → expired link, offers to request a new one
//  - 400 with fields → per-field server messages, the link is still usable
//  - 400 without fields → invalid/used link, offers to request a new one
//  - network/5xx → fixed retry message, form kept
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const token = searchParams.get('token')

  const {
    handleSubmit,
    register: bindField,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const [deadLinkMessage, setDeadLinkMessage] = useState(token ? null : INVALID_RESET_LINK_MESSAGE)
  const [formError, setFormError] = useState('')

  const onSubmit = async (values) => {
    setFormError('')
    const result = await resetPassword(token, values.password, values.confirmPassword)

    if (result.ok) {
      showSnackbar(result.message || RESET_SUCCESS_MESSAGE)
      navigate('/login', { replace: true })
      return
    }
    if (result.network) {
      setFormError(RESET_PASSWORD_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.status === 410) {
      setDeadLinkMessage(EXPIRED_RESET_LINK_MESSAGE)
      return
    }
    if (result.status === 400 && Object.keys(result.fields ?? {}).length > 0) {
      for (const [field, message] of Object.entries(result.fields)) {
        setError(field, { type: 'server', message })
      }
      return
    }
    setDeadLinkMessage(INVALID_RESET_LINK_MESSAGE)
  }

  return (
    <AuthPage title="Elegir una nueva contraseña">
      {deadLinkMessage ? (
        <section data-testid="reset-password-dead-link">
          <p role="alert">{deadLinkMessage}</p>
          <p>
            <Link to="/forgot-password">Solicitar un nuevo enlace</Link>
          </p>
        </section>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* FR-014/FR-016: same policy as registration, checked before sending. */}
          <TextField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            hint={PASSWORD_REQUIREMENTS}
            error={errors.password?.message}
            {...bindField('password', {
              required: 'La contraseña es obligatoria',
              validate: (value) => validatePassword(value) || true,
              deps: ['confirmPassword'],
            })}
          />

          <TextField
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...bindField('confirmPassword', {
              required: 'Debes confirmar la contraseña',
              validate: (value, formValues) =>
                validateConfirmPassword(formValues.password, value) || true,
            })}
          />

          {formError && (
            <p role="alert" data-testid="reset-password-error">
              {formError}
            </p>
          )}

          <SubmitButton loading={isSubmitting} loadingLabel="Guardando…">
            Guardar nueva contraseña
          </SubmitButton>
        </form>
      )}

      <nav aria-label="Enlaces de recuperación">
        <p>
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </nav>
    </AuthPage>
  )
}
