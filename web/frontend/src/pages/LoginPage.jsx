import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import AuthPage from '../components/AuthPage'
import LoginForm from '../components/LoginForm'
import { useAuth } from '../auth/AuthContext'

// Login page (feature 004). On success the profile goes into the shared
// session store and the user returns to where ProtectedRoute stopped them
// (state.from), or to the main screen (specs/015-main-screen). Logged-in users
// skip the form.
export default function LoginPage() {
  const { user, loading, setUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const destination = location.state?.from?.pathname ?? '/'

  if (loading) {
    return null
  }
  if (user) {
    return <Navigate to={destination} replace />
  }

  const handleLoggedIn = (profile) => {
    setUser(profile)
    navigate(destination, { replace: true })
  }

  return (
    <AuthPage title="Iniciar sesión">
      <LoginForm onLoggedIn={handleLoggedIn} />
      <nav aria-label="Enlaces de inicio de sesión">
        <p>
          <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
        </p>
        <p>
          ¿No tenés cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </nav>
    </AuthPage>
  )
}
