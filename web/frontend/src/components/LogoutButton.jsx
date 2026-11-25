import { startTransition } from 'react'
import { useNavigate } from 'react-router'
import { logout } from '../api/authClient'
import { useAuth } from '../auth/AuthContext'
import { LogoutIcon } from './NavIcons'

// Cerrar sesión en la barra global (pedido fuera de specs): con el backend
// expirando la cookie HttpOnly, la sesión local se limpia pase lo que pase
// para nunca quedar a medias (mismo contrato que tenía el dashboard retirado);
// vuelve al login.
export default function LogoutButton() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    // El outcome del backend no bloquea: la cookie HttpOnly ya se expiró (o
    // expira aunque falle la fetch), así que se limpia la sesión igual; el
    // error se traga para no quedar como unhandled rejection.
    try {
      await logout()
    } catch {
      // Sin sesión del backend: el cleanup local alcanza.
    }
    // React Router aplica el cambio de URL dentro de una transición. Si
    // setUser(null) fuera urgente, se renderizaría antes con la URL vieja y
    // ProtectedRoute mandaría al login con state.from (p. ej. /profile), así
    // que el próximo login volvería ahí en vez de a la pantalla principal.
    // Las dos actualizaciones van en la misma transición para aplicarse juntas.
    startTransition(() => {
      setUser(null)
      navigate('/login', { replace: true })
    })
  }

  return (
    <button
      type="button"
      className="app-header__action"
      onClick={handleLogout}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogoutIcon />
    </button>
  )
}
