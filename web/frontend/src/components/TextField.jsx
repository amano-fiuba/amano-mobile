import { useId, useState } from 'react'

// Reusable form field (task T029; FR-008, FR-013, FR-018): label + input,
// hidden password by default, accessible error state (aria-invalid +
// role=alert) and visual invalid highlighting. Errors come from the
// registerValidation.js rules, surfacing without touching other fields.
export default function TextField({
  label,
  type = 'text',
  error,
  hint,
  leadingIcon,
  hideLabel = false,
  required,
  transformOnBlur,
  ...inputProps
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const inputType = type === 'password' && revealed ? 'text' : type

  const handleBlur = (event) => {
    if (transformOnBlur) {
      transformOnBlur(event)
    }
    inputProps?.onBlur?.(event)
  }

  const isPassword = type === 'password'
  const describedBy = [
    hint ? `${id}-hint` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined

  const input = (
    <input
      {...inputProps}
      id={id}
      type={inputType}
      aria-invalid={error ? true : undefined}
      aria-required={required ? true : undefined}
      aria-describedby={describedBy}
      onBlur={handleBlur}
    />
  )

  return (
    <div className={error ? 'field field--invalid' : 'field'}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      {leadingIcon ? (
        <span className="field__control field__control--with-icon">
          <span className="field__icon" aria-hidden="true">
            {leadingIcon}
          </span>
          {input}
        </span>
      ) : (
        input
      )}
      {isPassword && (
        <button
          type="button"
          className="text-button"
          aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setRevealed((visible) => !visible)}
        >
          {revealed ? 'Ocultar' : 'Mostrar'}
        </button>
      )}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" id={`${id}-error`} data-testid={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
