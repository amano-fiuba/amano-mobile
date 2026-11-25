import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import AppHeader from './AppHeader'
import ThemeToggle from './ThemeToggle'

// Barra global: con sesión es AppHeader (specs/015-main-screen); los visitantes
// ven los accesos públicos.
const linkClass = ({ isActive }) =>
  isActive ? 'site-nav__link is-active' : 'site-nav__link'

export default function SiteNav() {
  const { user } = useAuth() ?? {}

  if (user) {
    return <AppHeader />
  }

  return (
    <header className="site-nav">
      <Link to="/" className="site-nav__brand" aria-label="A mano, ir al inicio">
        <img
          src="/logo.png"
          alt=""
          className="site-nav__logo"
          width={59}
          height={32}
        />
        A mano
      </Link>

      <nav className="site-nav__links" aria-label="Navegación principal">
        <NavLink to="/" end className={linkClass}>
          Inicio
        </NavLink>
        <NavLink to="/login" className={linkClass}>
          Iniciar sesión
        </NavLink>
        <NavLink to="/register" className={linkClass}>
          Registrarse
        </NavLink>
      </nav>

      <ThemeToggle />
    </header>
  )
}
