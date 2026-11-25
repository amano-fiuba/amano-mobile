import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import AuthPage from '../components/AuthPage'
import ResendCountdown from '../components/ResendCountdown'
import SubmitButton from '../components/SubmitButton'
import TextField from '../components/TextField'
import { normalizeEmail, validateEmail } from '../validation/registerValidation'

// Expired-link screen (task T035 + T053, feature 003, FR-006/FR-012): the 24 h
// window of the token passed, so the page explains it and offers the resend
// flow. The user types the address and submitting it already is the request:
// ResendCountdown (autoResend) shows the neutral message and the 5-minute
// countdown that the server dictates (FR-013/SC-006).
export default function ExpiredLinkPage() {
  const {
    handleSubmit,
    register: bindField,
    formState: { errors },
  } = useForm({ mode: 'onBlur' })

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = (values) => {
    setEmail(normalizeEmail(values.email))
    setSubmitted(true)
  }

  return (
    <AuthPage title="El enlace expiró">
      <p>
        Tu enlace de verificación ha expirado. Ingresa tu correo electrónico y te
        enviaremos uno nuevo.
      </p>
      {submitted ? (
        <ResendCountdown email={email} autoResend />
      ) : (
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
          <SubmitButton>Enviar correo de verificación</SubmitButton>
        </form>
      )}
      <nav aria-label="Enlaces de verificación">
        <p>
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </nav>
    </AuthPage>
  )
}
