import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  PASSWORD_REQUIREMENTS,
  normalizeCbu,
  normalizeEmail,
  trim,
  validateAcceptTerms,
  validateCbu,
  validateConfirmPassword,
  validateEmail,
  validateFirstName,
  validateLastName,
  validatePassword,
} from '../validation/registerValidation'
import { NETWORK_ERROR_MESSAGE, register } from '../api/authClient'
import AvatarUploader from './AvatarUploader'
import CurrencySelector from './CurrencySelector'
import SubmitButton from './SubmitButton'
import TextField from './TextField'

// Registration form (tasks T022 + T030; FR-001, FR-008, FR-009, FR-012, FR-013,
// FR-015, FR-017, FR-018): live rules from registerValidation.js shown on blur
// without wiping validated data; server messages arrive via ProblemDetail
// fields; the submit button is disabled during flight and re-enabled on any
// outcome. Optional fields (lastName, CBU/CVU) never block the rest when left
// empty (FR-003).
export default function RegisterForm({ onRegistered }) {
  const {
    handleSubmit,
    watch,
    register: bindField,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const [formError, setFormError] = useState('')
  // US3 optional parts (T036): kept out of RHF so they never block the rest.
  const [avatarFile, setAvatarFile] = useState(null)
  const [currencies, setCurrencies] = useState([])
  const password = watch('password') ?? ''
  const confirmation = watch('confirmPassword') ?? ''

  // Live password match (FR-013): revalidate the confirmation whenever the
  // password changes after both fields were touched.
  useEffect(() => {
    if (confirmation) {
      trigger('confirmPassword')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  /** Q4/Q3 blur transform: trim names / strip CBU separators, then revalidate. */
  const blurTransform = (field, transform) => (event) => {
    const normalized = transform(event.target.value)
    if (normalized !== event.target.value) {
      event.target.value = normalized
    }
    setValue(field, normalized, { shouldValidate: true })
  }

  const rules = (validate) => ({
    validate: (value) => {
      const message = validate(value)
      return message === '' || message
    },
  })

  const onSubmit = async (values) => {
    setFormError('')
    const formData = new FormData()
    formData.append('firstName', values.firstName)
    formData.append('lastName', values.lastName ?? '')
    formData.append('email', normalizeEmail(values.email))
    formData.append('password', values.password)
    formData.append('confirmPassword', values.confirmPassword)
    formData.append('cbuCvu', values.cbuCvu ? normalizeCbu(values.cbuCvu) : '')
    formData.append('acceptTerms', values.acceptTerms ? 'true' : 'false')
    // US3 optional parts: only appended when chosen (empty ⇒ nothing, FR-003/Q1).
    for (const code of currencies) {
      formData.append('currencies', code)
    }
    if (avatarFile) {
      formData.append('avatar', avatarFile, avatarFile.name)
    }

    const result = await register(formData)

    if (result.ok) {
      onRegistered(result.email)
      return
    }
    if (result.network) {
      // FR-019/FR-017: fixed message, keep the data, button re-enabled.
      setFormError(NETWORK_ERROR_MESSAGE)
      return
    }
    const { fields, detail } = result
    if (fields && Object.keys(fields).length > 0) {
      for (const [field, message] of Object.entries(fields)) {
        setError(field, { type: 'server', message })
      }
    }
    else if (detail) {
      setFormError(detail)
    }
    else {
      setFormError(NETWORK_ERROR_MESSAGE)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField
        label="Nombre *"
        required
        transformOnBlur={blurTransform('firstName', trim)}
        error={errors.firstName?.message}
        {...bindField('firstName', {
          required: 'El nombre es obligatorio',
          ...rules(validateFirstName),
        })}
      />

      <TextField
        label="Apellido"
        transformOnBlur={blurTransform('lastName', trim)}
        error={errors.lastName?.message}
        {...bindField('lastName', rules(validateLastName))}
      />

      <TextField
        label="Correo electrónico *"
        type="email"
        required
        error={errors.email?.message}
        {...bindField('email', {
          required: 'El correo electrónico es obligatorio',
          ...rules(validateEmail),
        })}
      />

      {/* FR-008: hidden by default; TextField offers the Mostrar/Ocultar toggle. */}
      <TextField
        label="Contraseña *"
        type="password"
        required
        autoComplete="new-password"
        hint={PASSWORD_REQUIREMENTS}
        error={errors.password?.message}
        {...bindField('password', {
          required: 'La contraseña es obligatoria',
          ...rules(validatePassword),
        })}
      />

      <TextField
        label="Confirmar contraseña *"
        type="password"
        required
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...bindField('confirmPassword', {
          required: 'Debes confirmar la contraseña',
          validate: () => validateConfirmPassword(password, confirmation) || true,
        })}
      />

      <TextField
        label="CBU/CVU"
        transformOnBlur={blurTransform('cbuCvu', normalizeCbu)}
        error={errors.cbuCvu?.message}
        {...bindField('cbuCvu', rules(validateCbu))}
      />

      {/* US3 optional parts (FR-003): empty ⇒ nothing persisted, never blocking. */}
      <AvatarUploader onFileSelected={setAvatarFile} />
      <CurrencySelector onChange={setCurrencies} />

      <div>
        <label>
          <input
            type="checkbox"
            {...bindField('acceptTerms', rules(validateAcceptTerms))}
          />
          Acepto los Términos y Condiciones *
        </label>
        {errors.acceptTerms && <p role="alert">{errors.acceptTerms.message}</p>}
      </div>

      {formError && (
        <p role="alert" data-testid="form-error">
          {formError}
        </p>
      )}

      <p className="field__hint" data-testid="required-fields-note">
        Los campos con (*) son obligatorios
      </p>

      {/* FR-015: disabled immediately on submit; re-enabled by RHF on any outcome. */}
      <SubmitButton loading={isSubmitting}>Crear cuenta</SubmitButton>
    </form>
  )
}
