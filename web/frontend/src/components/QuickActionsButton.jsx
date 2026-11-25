import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { useDismiss } from '../hooks/useDismiss'
import { useMediaQuery } from '../hooks/useMediaQuery'
import FriendChooserDialog from './FriendChooserDialog'
import GroupChooserDialog from './GroupChooserDialog'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FriendIcon,
  GroupsIcon,
  PersonIcon,
  PlusIcon,
} from './NavIcons'

const EXPENSE_LABEL = 'Registrar gasto'
// specs/033-income-management: the personal income form, one tap from the (+) menu.
const INCOME_LABEL = 'Registrar ingreso'

// specs/027-expense-entry-modes, FR-001: the three ways to register an expense.
// "Gasto con amigo" and "Gasto grupal" open a chooser before the form.
const EXPENSE_OPTIONS = [
  { key: 'personal', label: 'Gasto personal', Icon: PersonIcon, to: '/expenses/new', enabled: true },
  { key: 'friend', label: 'Gasto con amigo', Icon: FriendIcon, enabled: true },
  { key: 'group', label: 'Gasto grupal', Icon: GroupsIcon, enabled: true },
]

const MOBILE_QUERY = '(max-width: 767px)'
// Lets the pointer travel from "Registrar gasto" to its submenu without closing it.
const CLOSE_DELAY_MS = 150

// Items of a menu list, in order (the submenu trigger counts once).
function menuItems(list) {
  return Array.from(list.children)
    .map((child) => child.querySelector('[role="menuitem"]'))
    .filter(Boolean)
}

// Arrow/Home/End navigation between the items of `list`. Returns true if handled.
function moveFocus(event, list) {
  const items = menuItems(list)
  const index = items.indexOf(event.target)
  if (index === -1) {
    return false
  }
  const last = items.length - 1
  const next = {
    ArrowDown: index === last ? 0 : index + 1,
    ArrowUp: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]
  if (next === undefined) {
    return false
  }
  event.preventDefault()
  items[next].focus()
  return true
}

// Botón "+" fijo abajo a la izquierda (specs/015-main-screen, US4). Desde la
// 027, "Registrar gasto" abre un submenú con las formas de registrar un gasto; desde
// la 033, "Registrar ingreso" lleva directo al alta de un ingreso personal.
export default function QuickActionsButton() {
  const { user } = useAuth() ?? {}
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)
  // Option whose chooser dialog is open ("friend" or "group"); it outlives the menu.
  const [chooser, setChooser] = useState(null)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const submenuRef = useRef(null)
  const closeTimer = useRef(null)
  const openedByClick = useRef(false)
  const focusOnOpen = useRef(false)
  const focusTriggerOnClose = useRef(false)

  const cancelScheduledClose = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  const close = useCallback(() => {
    clearTimeout(closeTimer.current)
    closeTimer.current = null
    setIsOpen(false)
    setIsSubmenuOpen(false)
  }, [])
  useDismiss(containerRef, isOpen, close)

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const openSubmenu = ({ focusFirst = false, byClick = false } = {}) => {
    cancelScheduledClose()
    focusOnOpen.current = focusFirst
    openedByClick.current = byClick
    setIsSubmenuOpen(true)
  }

  const closeSubmenu = ({ focusTrigger = false } = {}) => {
    cancelScheduledClose()
    focusTriggerOnClose.current = focusTrigger
    openedByClick.current = false
    setIsSubmenuOpen(false)
  }

  // FR-003: if the submenu does not fit on the right, use the alternate position.
  useLayoutEffect(() => {
    if (!isSubmenuOpen) {
      if (focusTriggerOnClose.current) {
        focusTriggerOnClose.current = false
        triggerRef.current?.focus()
      }
      return
    }
    // A layout measurement applied straight to the DOM, so it lands before paint.
    if (!isMobile && submenuRef.current) {
      const overflows = submenuRef.current.getBoundingClientRect().right > window.innerWidth
      submenuRef.current.classList.toggle('quick-actions__submenu--flip', overflows)
    }
    if (focusOnOpen.current && submenuRef.current) {
      focusOnOpen.current = false
      menuItems(submenuRef.current)[0]?.focus()
    }
  }, [isSubmenuOpen, isMobile])

  if (!user) {
    return null
  }

  const toggleMenu = () => {
    if (isOpen) {
      close()
    } else {
      setIsOpen(true)
    }
  }

  // A hover may have opened it already: the click then "pins" it instead of closing it.
  const handleTriggerClick = () => {
    if (isSubmenuOpen && openedByClick.current) {
      closeSubmenu()
    } else {
      openSubmenu({ byClick: true })
    }
  }

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openSubmenu({ focusFirst: true, byClick: true })
    }
  }

  const handleMenuKeyDown = (event) => {
    moveFocus(event, event.currentTarget)
  }

  const handleSubmenuKeyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'Escape') {
      // Only the submenu closes; the document-level Escape of useDismiss must not run.
      event.preventDefault()
      event.stopPropagation()
      closeSubmenu({ focusTrigger: true })
      return
    }
    if (moveFocus(event, event.currentTarget)) {
      event.stopPropagation()
    }
  }

  const handlePointerEnter = () => {
    cancelScheduledClose()
    if (!isMobile && !isSubmenuOpen) {
      openSubmenu()
    }
  }

  const handlePointerLeave = () => {
    if (isMobile) {
      return
    }
    cancelScheduledClose()
    closeTimer.current = setTimeout(() => closeSubmenu(), CLOSE_DELAY_MS)
  }

  const expenseOptions = EXPENSE_OPTIONS.filter((option) => option.enabled).map((option) => (
    <li key={option.key} role="none">
      {option.to ? (
        <Link to={option.to} role="menuitem" className="quick-actions__item" onClick={close}>
          <option.Icon />
          <span>{option.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          role="menuitem"
          className="quick-actions__item"
          onClick={() => {
            close()
            setChooser(option.key)
          }}
        >
          <option.Icon />
          <span>{option.label}</span>
        </button>
      )}
    </li>
  ))

  let menu = null
  if (isOpen && isMobile && isSubmenuOpen) {
    // In a narrow screen the submenu takes the place of the main list.
    menu = (
      <ul
        ref={submenuRef}
        role="menu"
        aria-label={EXPENSE_LABEL}
        className="quick-actions__menu"
        onKeyDown={handleSubmenuKeyDown}
      >
        <li role="none">
          <button
            type="button"
            role="menuitem"
            className="quick-actions__item quick-actions__back"
            onClick={() => closeSubmenu({ focusTrigger: true })}
          >
            <ChevronLeftIcon />
            <span>Volver</span>
          </button>
        </li>
        {expenseOptions}
      </ul>
    )
  } else if (isOpen) {
    menu = (
      <ul
        role="menu"
        aria-label="Acciones rápidas"
        className="quick-actions__menu"
        onKeyDown={handleMenuKeyDown}
      >
        <li role="none">
          <Link to="/groups/new" role="menuitem" className="quick-actions__item" onClick={close}>
            Crear grupo
          </Link>
        </li>
        <li
          role="none"
          className="quick-actions__parent"
          onMouseEnter={handlePointerEnter}
          onMouseLeave={handlePointerLeave}
        >
          <button
            ref={triggerRef}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={isSubmenuOpen}
            className={`quick-actions__item${isSubmenuOpen ? ' is-active' : ''}`}
            onClick={handleTriggerClick}
            onKeyDown={handleTriggerKeyDown}
          >
            <span>{EXPENSE_LABEL}</span>
            <ChevronRightIcon />
          </button>
          {isSubmenuOpen && (
            <ul
              ref={submenuRef}
              role="menu"
              aria-label={EXPENSE_LABEL}
              className="quick-actions__menu quick-actions__submenu"
              onKeyDown={handleSubmenuKeyDown}
            >
              {expenseOptions}
            </ul>
          )}
        </li>
        <li role="none">
          <Link to="/incomes/new" role="menuitem" className="quick-actions__item" onClick={close}>
            {INCOME_LABEL}
          </Link>
        </li>
        <li role="none">
          <Link
            to="/expenses/recurring"
            role="menuitem"
            className="quick-actions__item"
            onClick={close}
          >
            Gastos recurrentes
          </Link>
        </li>
      </ul>
    )
  }

  return (
    <div className="quick-actions" ref={containerRef}>
      {menu}
      <button
        type="button"
        className={isOpen ? 'quick-actions__toggle is-open' : 'quick-actions__toggle'}
        aria-label="Acciones rápidas"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <PlusIcon />
      </button>
      {chooser === 'group' && <GroupChooserDialog onClose={() => setChooser(null)} />}
      {chooser === 'friend' && <FriendChooserDialog onClose={() => setChooser(null)} />}
    </div>
  )
}
