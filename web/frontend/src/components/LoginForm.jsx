import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { normalizeEmail, validateEmail } from '../validation/registerValidation'
import { LOGIN_NETWORK_ERROR_MESSAGE, login } from '../api/authClient'
import ResendCountdown from './ResendCountdown'
import SubmitButton from './SubmitButton'
import TextField from './TextField'

export const BAD_CREDENTIALS_MESSAGE =
  'El correo electrónico o la contraseña son incorrectos'
export const UNVERIFIED_MESSAGE =
  'Tu cuenta aún no ha sido verificada. Por favor, revisa tu correo electrónico'

// Login form (feature 004). Outcomes of login():
//  - 200 → onLoggedIn(profile)
//  - 400 → per-field server messages
//  - 401 → generic message, password cleared, email kept
//  - 403 RESEND_VERIFICATION → notice + resend button (reuses feature 003)
//  - network/5xx → fixed retry message
export default function LoginForm({ onLoggedIn }) {
  const {
    handleSubmit,
    register: bindField,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const [formError, setFormError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)

  const onSubmit = async (values) => {
    setFormError('')
    setUnverifiedEmail(null)
    const email = normalizeEmail(values.email)

    const result = await login(email, values.password)

    if (result.ok) {
      onLoggedIn(result.profile)
      return
    }
    if (result.network) {
      setFormError(LOGIN_NETWORK_ERROR_MESSAGE)
      return
    }
    if (result.status === 403 && result.action === 'RESEND_VERIFICATION') {
      setUnverifiedEmail(email)
      return
    }
    if (result.status === 400 && Object.keys(result.fields ?? {}).length > 0) {
      for (const [field, message] of Object.entries(result.fields)) {
        setError(field, { type: 'server', message })
      }
      return
    }
    if (result.status === 401) {
      setValue('password', '')
      setFormError(BAD_CREDENTIALS_MESSAGE)
      return
    }
    setFormError(result.detail || LOGIN_NETWORK_ERROR_MESSAGE)
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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

        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...bindField('password', {
            required: 'La contraseña es obligatoria',
          })}
        />

        {formError && (
          <p role="alert" data-testid="login-error">
            {formError}
          </p>
        )}

        <SubmitButton loading={isSubmitting} loadingLabel="Ingresando…">
          Iniciar sesión
        </SubmitButton>
      </form>

      {unverifiedEmail && (
        <section data-testid="login-unverified">
          <p role="alert">{UNVERIFIED_MESSAGE}</p>
          <ResendCountdown key={unverifiedEmail} email={unverifiedEmail} />
        </section>
      )}
    </>
  )
}
