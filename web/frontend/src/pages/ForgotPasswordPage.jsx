import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { normalizeEmail, validateEmail } from '../validation/registerValidation'
import { FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE, forgotPassword } from '../api/authClient'
import AuthPage from '../components/AuthPage'
import SubmitButton from '../components/SubmitButton'
import TextField from '../components/TextField'

export const CHECK_INBOX_MESSAGE = 'Revisa tu bandeja de entrada'

// Password recovery request (feature 006). The backend answers the same neutral
// message whether the address has an account or not (FR-002), so the screen
// shows the very same success state in every case; only network/5xx fails.
export default function ForgotPasswordPage() {
  const {
    handleSubmit,
    register: bindField,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const [sentMessage, setSentMessage] = useState(null)
  const [formError, setFormError] = useState('')

  const onSubmit = async (values) => {
    setFormError('')
    const result = await forgotPassword(normalizeEmail(values.email))
    if (result.ok) {
      setSentMessage(result.message)
      return
    }
    setFormError(FORGOT_PASSWORD_NETWORK_ERROR_MESSAGE)
  }

  return (
    <AuthPage title="Recuperar contraseña">
      {sentMessage ? (
        <section
          role="status"
          data-testid="forgot-password-sent"
          className="form-success"
        >
          <h2>{CHECK_INBOX_MESSAGE}</h2>
          <p>{sentMessage}</p>
        </section>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <p>Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.</p>

          <TextField
            label="Correo electrónico"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...bindField('email', {
              required: 'El correo electrónico es obligatorio',
              validate: (value) => validateEmail(value) || true,
            })}
          />

          {formError && (
            <p role="alert" data-testid="forgot-password-error">
              {formError}
            </p>
          )}

          <SubmitButton loading={isSubmitting} loadingLabel="Enviando…">
            Restablecer contraseña
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
