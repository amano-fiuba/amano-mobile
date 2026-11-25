import { useEffect, useId, useRef } from 'react'

/**
 * Base de todos los modales de confirmación de la app. Es el único lugar que
 * arma el fondo, la tarjeta, la "×" (la única forma de cancelar: no hay botón
 * "Cancelar"), Escape, el foco inicial y el error. Cada modal concreto solo
 * pasa el título, el mensaje (`children`) y la acción.
 *
 * - Sin `onConfirm` el modal es solo informativo: queda la "×" para cerrar.
 * - Con `busy` no se puede cerrar ni confirmar (hay una solicitud en curso).
 * - `wide` lo ensancha para contenidos con listas (agregar amigos a un grupo);
 *   ahí `describedByBody={false}` evita que el lector de pantalla lea toda la
 *   lista como descripción del diálogo.
 */
export default function ConfirmModal({
  title,
  children,
  error = '',
  busy = false,
  onClose,
  onConfirm,
  confirmLabel = 'Confirmar',
  busyConfirmLabel,
  testId,
  errorTestId,
  wide = false,
  describedByBody = true,
}) {
  const closeRef = useRef(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  return (
    <div className="confirm-modal__backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedByBody ? messageId : undefined}
        className={wide ? 'confirm-modal confirm-modal--wide' : 'confirm-modal'}
        data-testid={testId}
      >
        <button
          type="button"
          ref={closeRef}
          className="confirm-modal__close"
          aria-label="Cerrar"
          disabled={busy}
          onClick={() => onClose?.()}
        >
          <span aria-hidden="true">×</span>
        </button>
        <h3 id={titleId}>{title}</h3>
        <div id={messageId} className="confirm-modal__body">
          {children}
        </div>
        {error && (
          <p className="confirm-modal__error" role="alert" data-testid={errorTestId}>
            {error}
          </p>
        )}
        {onConfirm && (
          <div className="confirm-modal__actions">
            <button
              type="button"
              className="confirm-modal__confirm"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy && busyConfirmLabel ? busyConfirmLabel : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
