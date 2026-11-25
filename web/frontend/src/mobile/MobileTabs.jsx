import { Children, isValidElement, useId, useRef, useState } from 'react'
import { isMobileLayout } from './mobileLayout'

// Pestañas para pantallas largas en el celular (amano-mobile specs/002-diseno-movil-y-notificaciones).
//
// En la web `MobileTabs` no cambia nada: dibuja su contenedor (si tiene
// `className`) con los hijos tal cual, `MobileTab` es transparente y
// `MobileTabGroup` dibuja su <div>. Así el HTML de escritorio queda idéntico.
//
// En la app muestra una barra de pestañas y una sola sección por vez. Todas
// quedan montadas (las ocultas con `hidden`), así no se pierden datos ni lo que
// la persona escribió al cambiar de pestaña. También se cambia deslizando.

/** Una sección; en la web solo devuelve su contenido. */
export function MobileTab({ children }) {
  return children
}

/** Agrupa pestañas que en la web comparten un contenedor (por ejemplo, columnas). */
export function MobileTabGroup({ className, children }) {
  return <div className={className}>{children}</div>
}

function collectTabs(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === MobileTab) out.push(child)
    else if (child.type === MobileTabGroup) collectTabs(child.props.children, out)
  })
  return out
}

function readStored(key) {
  try {
    return key ? window.sessionStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    if (key) window.sessionStorage.setItem(key, value)
  } catch {
    // sin almacenamiento: la pestaña vuelve a la primera
  }
}

const SWIPE_MIN_PX = 60

function rank(order, id) {
  const index = order.indexOf(id)
  return index === -1 ? order.length : index
}

export default function MobileTabs({
  name,
  label,
  className,
  children,
  mobile = isMobileLayout(),
  active: controlledActive,
  onChange,
  variant = 'tabs',
  order,
}) {
  const baseId = useId()
  const collected = collectTabs(children)
  // `order` permite otro orden en el celular sin tocar el HTML de la web.
  const tabs = order
    ? [...collected].sort((a, b) => rank(order, a.props.id) - rank(order, b.props.id))
    : collected
  const storageKey = name ? `amano-tab-${name}` : null
  const [ownActive, setOwnActive] = useState(() => readStored(storageKey))
  const touch = useRef(null)
  const tabRefs = useRef({})

  if (!mobile) {
    return className ? <div className={className}>{children}</div> : <>{children}</>
  }
  // Con una sola sección (por ejemplo, al editar un gasto) no hacen falta pestañas.
  if (tabs.length < 2) {
    const only = tabs[0]?.props.children ?? null
    return className ? <div className={className}>{only}</div> : <>{only}</>
  }

  const ids = tabs.map((tab) => tab.props.id)
  const wanted = controlledActive ?? ownActive
  const activeId = ids.includes(wanted) ? wanted : ids[0]
  const activeIndex = ids.indexOf(activeId)

  const select = (id, focus = false) => {
    if (controlledActive === undefined) setOwnActive(id)
    writeStored(storageKey, id)
    onChange?.(id)
    if (focus) tabRefs.current[id]?.focus()
  }

  const onKeyDown = (event) => {
    const next = {
      ArrowRight: (activeIndex + 1) % ids.length,
      ArrowLeft: (activeIndex - 1 + ids.length) % ids.length,
      Home: 0,
      End: ids.length - 1,
    }[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(ids[next], true)
  }

  const onTouchStart = (event) => {
    const point = event.touches[0]
    // No se roba el gesto a lo que se desplaza en horizontal (tablas, chips).
    const scroller = event.target.closest?.('[data-swipe-ignore], input, textarea, select')
    touch.current = scroller ? null : { x: point.clientX, y: point.clientY }
  }

  const onTouchEnd = (event) => {
    const start = touch.current
    touch.current = null
    if (!start || variant === 'steps') return
    const point = event.changedTouches[0]
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const next = activeIndex + (dx < 0 ? 1 : -1)
    if (next >= 0 && next < ids.length) select(ids[next])
  }

  return (
    <div
      className={`mobile-tabs mobile-tabs--${variant}${className ? ` ${className}` : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="mobile-tabs__bar" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => {
          const { id, label: tabLabel, badge } = tab.props
          const selected = id === activeId
          return (
            <button
              key={id}
              ref={(node) => {
                tabRefs.current[id] = node
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              className="mobile-tabs__tab"
              onClick={() => select(id)}
              onKeyDown={onKeyDown}
            >
              {variant === 'steps' && <span className="mobile-tabs__step">{index + 1}</span>}
              <span className="mobile-tabs__label">{tabLabel}</span>
              {badge ? <span className="mobile-tabs__badge">{badge}</span> : null}
            </button>
          )
        })}
      </div>
      {tabs.map((tab) => {
        const { id } = tab.props
        return (
          <div
            key={id}
            role="tabpanel"
            id={`${baseId}-panel-${id}`}
            aria-labelledby={`${baseId}-tab-${id}`}
            className="mobile-tabs__panel"
            hidden={id !== activeId}
          >
            {tab.props.children}
          </div>
        )
      })}
    </div>
  )
}
