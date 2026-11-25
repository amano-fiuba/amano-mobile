import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { userAvatarUrl } from '../auth/userAvatar'
import GlobalSearch from './GlobalSearch'
import LogoutButton from './LogoutButton'
import NotificationsMenu from './NotificationsMenu'
import {
  ActivityIcon,
  FriendsIcon,
  GroupsIcon,
  StatisticsIcon,
} from './NavIcons'
import ThemeToggle from './ThemeToggle'
import './AppHeader.scss'
import ApiImage from './ApiImage'
import { isMobileLayout } from '../mobile/mobileLayout'

const linkClass = ({ isActive }) =>
  isActive ? 'app-header__action is-active' : 'app-header__action'

function ActionLink({ to, label, children }) {
  return (
    <NavLink to={to} className={linkClass} aria-label={label} title={label}>
      {children}
    </NavLink>
  )
}

// Barra superior con sesión (specs/015-main-screen, US2): logo, buscador y
// accesos a perfil, actividad, estadísticas (032), grupos, amigos, notificaciones,
// cambio de tema y cierre de sesión.
export default function AppHeader({ mobile = isMobileLayout() }) {
  const { user } = useAuth()

  // App móvil (mobile 002): logo, buscador y notificaciones; el resto de los accesos
  // vive en la barra inferior (mobile/MobileTabBar).
  if (mobile) {
    return (
      <header className="app-header app-header--mobile">
        <Link to="/" className="app-header__brand" aria-label="A mano, ir al inicio">
          <img src="/logo.png" alt="" width={59} height={32} />
        </Link>
        <GlobalSearch />
        <nav className="app-header__actions" aria-label="Avisos">
          <NotificationsMenu />
        </nav>
      </header>
    )
  }

  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand" aria-label="A mano, ir al inicio">
        <img src="/logo.png" alt="" width={59} height={32} />
        A mano
      </Link>

      <GlobalSearch />

      <nav className="app-header__actions" aria-label="Navegación principal">
        <ActionLink to="/profile" label="Mi perfil">
          <ApiImage src={userAvatarUrl(user)} alt="" width={40} height={40} />
        </ActionLink>
        <ActionLink to="/activity" label="Actividad personal">
          <ActivityIcon />
        </ActionLink>
        <ActionLink to="/statistics" label="Estadísticas">
          <StatisticsIcon />
        </ActionLink>
        <ActionLink to="/groups" label="Mis grupos">
          <GroupsIcon />
        </ActionLink>
        <ActionLink to="/friends" label="Amigos">
          <FriendsIcon />
        </ActionLink>
        <NotificationsMenu />
        <ThemeToggle />
        <LogoutButton />
      </nav>
    </header>
  )
}
