import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { me } from '../api/authClient'
import { useAuth } from '../auth/AuthContext'
import CopyCbuButton from '../components/CopyCbuButton'
import HomeLink from '../components/HomeLink'
import ApiImage from '../components/ApiImage'

// Pantalla "Mi perfil" (specs/002-user-profile): los datos provienen
// únicamente del contrato de sesión GET /api/users/me vía me();
// refresco explícito al montar (igual que el dashboard). La contraseña nunca
// se muestra en claro (FR-007 de 001): presentación enmascarada (FR-002).
// Opcionales ausentes → "No informado" (FR-004); monedas vacías → ARS (FR-006);
// sin avatar propio (o imagen caída) → avatar por defecto (FR-005). Desde 005
// (FR-001) la edición vive en /profile/edit, accesible desde aquí.
export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    me().then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setUser(result.profile)
        setError(false)
      } else if (result.network) {
        // FR-009: red/servidor caído → mensaje, sin datos incompletos.
        setError(true)
      }
      // 401 (sin sesión): el ProtectedRoute de la ruta redirige.
    }).catch(() => {
      if (!cancelled) {
        setError(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [setUser])

  if (!user || error) {
    if (error) {
      return (
        <main className="page">
          <HomeLink />
          <h1>Mi perfil</h1>
          <p role="alert">No se pudo cargar el perfil. Intenta nuevamente</p>
        </main>
      )
    }
    return null
  }

  const avatarUrl =
    user.hasCustomAvatar && user.avatarUrl ? user.avatarUrl : '/avatar-default.png'
  const currencies =
    Array.isArray(user.currencies) && user.currencies.length > 0
      ? user.currencies
      : ['ARS']

  return (
    <main className="page">
      <HomeLink />
      <ApiImage
        src={avatarUrl}
        alt={`Avatar de ${user.firstName}`}
        className="app-avatar"
      />
      <h1>Mi perfil</h1>
      <p>
        Nombre: <span data-testid="profile-name">{user.firstName}</span>
      </p>
      <p>
        Apellido:{' '}
        <span data-testid="profile-lastname">{user.lastName ?? 'No informado'}</span>
      </p>
      <p>
        Correo electrónico: <span data-testid="profile-email">{user.email}</span>
      </p>
      <p>
        Contraseña:{' '}
        <span data-testid="profile-password" aria-hidden="true">
          ●●●●●●●●
        </span>
        <span className="profile-password-caption">
          Por seguridad, la contraseña no se muestra
        </span>
      </p>
      {/* FR-009 de 001: el CBU/CVU es privado; aquí solo ve la sesión propia. */}
      <p className="profile-cbu-line">
        <span>
          CBU/CVU: <span data-testid="profile-cbu">{user.cbuCvu ?? 'No informado'}</span>
        </span>
        <CopyCbuButton value={user.cbuCvu} iconOnly />
      </p>
      <p>
        Monedas: <span data-testid="profile-currencies">{currencies.join(', ')}</span>
      </p>
      {/* FR-011 de 002 activado por 005: la edición vive en /profile/edit. */}
      <p>
        <Link to="/profile/edit">Modificar perfil</Link>
      </p>
    </main>
  )
}
