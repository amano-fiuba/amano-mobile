import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { userAvatarUrl } from '../auth/userAvatar'
import ApiImage from '../components/ApiImage'
import LogoutButton from '../components/LogoutButton'
import {
  ActivityIcon,
  BellIcon,
  FriendsIcon,
  GroupsIcon,
  HistoryIcon,
  HomeIcon,
  MoreIcon,
  SearchIcon,
  StatisticsIcon,
} from '../components/NavIcons'
import ThemeToggle from '../components/ThemeToggle'
import { isMobileLayout, isTopLevelPath } from './mobileLayout'

// Barra inferior de la app (amano-mobile specs/002-diseno-movil-y-notificaciones): reemplaza en el celular a
// los ocho íconos de la barra superior. El botón "+" (QuickActionsButton) se
// ubica en el hueco central por CSS. En pantallas de detalle y formularios la
// barra se oculta para dejar todo el alto al contenido.

const MORE_LINKS = [
  { to: '/notifications', label: 'Notificaciones', Icon: BellIcon },
  { to: '/friends', label: 'Amigos', Icon: FriendsIcon },
  { to: '/users/search', label: 'Buscar personas', Icon: SearchIcon },
  { to: '/statistics', label: 'Estadísticas', Icon: StatisticsIcon },
  { to: '/expenses/recurring', label: 'Gastos recurrentes', Icon: HistoryIcon },
]

const tabClass = ({ isActive }) => (isActive ? 'tab-bar__item is-active' : 'tab-bar__item')

function MoreSheet({ onClose }) {
  const { user } = useAuth()
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector('a')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="more-sheet" role="presentation">
      <button
        type="button"
        className="more-sheet__backdrop"
        aria-label="Cerrar menú"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="more-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Más opciones"
      >
        <span className="more-sheet__grip" aria-hidden="true" />
        <Link to="/profile" className="more-sheet__profile" onClick={onClose}>
          <ApiImage src={userAvatarUrl(user)} alt="" width={48} height={48} />
          <span>
            <strong>
              {user?.firstName} {user?.lastName ?? ''}
            </strong>
            <small>Ver mi perfil</small>
          </span>
        </Link>
        <ul className="more-sheet__list">
          {MORE_LINKS.map(({ to, label, Icon }) => (
            <li key={to}>
              <Link to={to} onClick={onClose}>
                <Icon />
                {label}
              </Link>
            </li>
          ))}
        </ul>
        {/* Tema y cierre de sesión: en la web están en la barra superior. */}
        <div className="more-sheet__footer">
          <span className="more-sheet__theme">
            <ThemeToggle />
            Modo claro u oscuro
          </span>
          <span className="more-sheet__logout">
            <LogoutButton />
            Cerrar sesión
          </span>
        </div>
      </div>
    </div>
  )
}

export default function MobileTabBar({ mobile = isMobileLayout() }) {
  const { user } = useAuth() ?? {}
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const [openedAt, setOpenedAt] = useState(pathname)
  const visible = Boolean(mobile && user && isTopLevelPath(pathname))
  const closeMore = useCallback(() => setMoreOpen(false), [])

  // Al navegar se cierra el menú "Más".
  if (openedAt !== pathname) {
    setOpenedAt(pathname)
    if (moreOpen) setMoreOpen(false)
  }

  // Los estilos ocultan el botón "+" y quitan el relleno inferior sin la barra.
  useEffect(() => {
    if (!mobile) return undefined
    const root = document.documentElement
    root.dataset.tabBar = visible ? 'on' : 'off'
    return () => {
      delete root.dataset.tabBar
    }
  }, [mobile, visible])

  if (!visible) return null

  const moreActive = ['/notifications', '/friends', '/users/search', '/statistics', '/expenses/recurring', '/profile']
    .some((path) => pathname.startsWith(path))

  return (
    <>
      <nav className="tab-bar" aria-label="Secciones">
        <NavLink to="/" end className={tabClass}>
          <HomeIcon />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/groups" className={tabClass}>
          <GroupsIcon />
          <span>Grupos</span>
        </NavLink>
        <span className="tab-bar__slot" aria-hidden="true" />
        <NavLink to="/activity" className={tabClass}>
          <ActivityIcon />
          <span>Actividad</span>
        </NavLink>
        <button
          type="button"
          className={`tab-bar__item${moreActive || moreOpen ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <MoreIcon />
          <span>Más</span>
        </button>
      </nav>
      {moreOpen && <MoreSheet onClose={closeMore} />}
    </>
  )
}
