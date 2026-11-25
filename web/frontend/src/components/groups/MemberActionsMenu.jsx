import { useCallback, useEffect, useRef, useState } from 'react'
import { useDismiss } from '../../hooks/useDismiss'

/**
 * Acciones de administración de un miembro detrás de un botón "⋯". Es un
 * disclosure, no un role="menu": sus opciones son botones comunes que se
 * recorren con Tab, y una de ellas abre su confirmación dentro del panel.
 * `children` recibe `close` para que cada opción decida si cierra el panel.
 */
export default function MemberActionsMenu({ memberName, testId, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  const [position, setPosition] = useState(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismiss(containerRef, isOpen, close)

  // La lista de miembros scrollea: un panel `absolute` quedaría recortado por
  // ella. Se fija a la pantalla, bajo el botón, y se cierra si algo scrollea
  // (dejaría de estar alineado con su fila).
  useEffect(() => {
    if (!isOpen) return undefined
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen, close])

  function toggle() {
    if (!isOpen) {
      const rect = triggerRef.current?.getBoundingClientRect()
      setPosition(
        rect ? { top: rect.bottom + 4, right: window.innerWidth - rect.right } : null,
      )
    }
    setIsOpen(!isOpen)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      triggerRef.current?.focus()
    }
  }

  return (
    <div className="member-menu" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className="member-menu__trigger"
        aria-label={`Acciones de ${memberName}`}
        aria-expanded={isOpen}
        data-testid={testId}
        onClick={toggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {isOpen && (
        <div
          className={position ? 'member-menu__panel member-menu__panel--fixed' : 'member-menu__panel'}
          style={position ?? undefined}
        >
          {children(close)}
        </div>
      )}
    </div>
  )
}
