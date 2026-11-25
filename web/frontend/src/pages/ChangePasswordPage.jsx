// Cambio de contraseña (specs/005-edit-user-profile US2): exige acreditar la
// contraseña actual (FR-013/FR-014, clarificación 2026-10-20), aplica la
// política de 001 a la nueva con su confirmación (FR-006 de 001), mantiene la
// sesión activa tras el cambio (FR-013: el backend no rota el JWT) y conserva
// los datos escritos ante fallos (FR-019). La contraseña nunca se muestra en
// texto claro salvo el botón Mostrar/Ocultar del formulario (FR-008 de 001).
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import {
  UPDATE_NETWORK_ERROR_MESSAGE,
  updatePassword,
} from '../api/authClient'
import { useSnackbar } from '../components/Snackbar'
import TextField from '../components/TextField'
import {
  validateConfirmPassword,
  validatePassword,
} from '../validation/registerValidation'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const {
    handleSubmit,
    watch,
    register: bindField,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ mode: 'onBlur' })

  const [formError, setFormError] = useState('')
  const showSnackbar = useSnackbar()
  const password = watch('newPassword') ?? ''
  const confirmation = watch('confirmPassword') ?? ''

  const rules = (validate) => ({
    validate: (value) => {
      const message = validate(value)
      return message === '' || message
    },
  })

  const onSubmit = async (values) => {
    setFormError('')
    const result = await updatePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      confirmPassword: values.confirmPassword,
    })

    if (result.ok) {
      // El cambio no rota la sesión: el usuario queda en la misma pantalla.
      showSnackbar('La contraseña se cambió correctamente')
      reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      return
    }
    if (result.network) {
      setFormError(UPDATE_NETWORK_ERROR_MESSAGE)
      return
    }
    const { fields, detail } = result
    const fieldNames = ['currentPassword', 'newPassword', 'confirmPassword']
    if (fields) {
      for (const [field, message] of Object.entries(fields)) {
        if (fieldNames.includes(field)) {
          setError(field, { type: 'server', message })
          continue
        }
      }
    }
    if (detail) {
      // Sin campos mapeables, el problema completo va como mensaje general.
      setFormError(detail)
    }
  }

  return (
    <main className="page">
      <nav className="group-page__back">
        <Link to="/profile">
          <span aria-hidden="true">←</span> Mi perfil
        </Link>
      </nav>
      <h1>Cambiar contraseña</h1>
      {formError && (
        <p role="alert" data-testid="form-error">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...bindField('currentPassword', { required: 'La contraseña actual es obligatoria' })}
        />

        <TextField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.newPassword?.message}
          {...bindField('newPassword', {
            required: 'La nueva contraseña es obligatoria',
            ...rules(validatePassword),
          })}
        />

        <TextField
          label="Confirmar nueva contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...bindField('confirmPassword', {
            required: 'Debes confirmar la nueva contraseña',
            validate: () => validateConfirmPassword(password, confirmation) || true,
          })}
        />

        {/* Cancelar a la izquierda y Guardar a la derecha. FR-011: Guardar
            deshabilitado durante el envío; rehabilitado ante errores. */}
        <div className="form-actions form-actions--split">
          <button type="button" onClick={() => navigate('/profile')}>
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting}>
            Guardar
          </button>
        </div>
      </form>
    </main>
  )
}
