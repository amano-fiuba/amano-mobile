import { useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '../utils/copyToClipboard'
import './CopyCbuButton.scss'

const FEEDBACK_MS = 2000

/**
 * Botón "Copiar CBU/CVU" para los CBU/CVU propios y de los integrantes de un
 * grupo. Copia el valor y confirma durante unos segundos. Por defecto muestra
 * icono + texto; con `iconOnly` solo muestra el icono (la etiqueta accesible y
 * el aviso para lectores de pantalla se mantienen). Si no hay valor no
 * renderiza nada.
 */
export default function CopyCbuButton({
  value,
  label = 'Copiar CBU/CVU',
  copiedLabel = '¡Copiado!',
  ariaLabel,
  className = '',
  iconOnly = false,
  testId,
  onCopied,
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)

  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )

  if (!value) {
    return null
  }

  async function handleClick() {
    const ok = await copyToClipboard(value)
    if (!ok) {
      return
    }
    setCopied(true)
    onCopied?.(value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS)
  }

  return (
    <button
      type="button"
      className={`copy-cbu${iconOnly ? ' copy-cbu--icon-only' : ''} ${className}`.trim()}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      onClick={handleClick}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {copied && iconOnly ? (
          <path d="m5 12 5 5L20 7" />
        ) : (
          <>
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
          </>
        )}
      </svg>
      <span className={iconOnly ? 'visually-hidden' : undefined} aria-live="polite">
        {copied ? copiedLabel : label}
      </span>
    </button>
  )
}
