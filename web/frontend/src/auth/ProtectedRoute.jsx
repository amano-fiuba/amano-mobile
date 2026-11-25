import { Navigate, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

// Gate for protected routes (task T015; SC-002): while the session check is
// in flight nothing renders; without a session the user is redirected to
// /login (feature 004; it was /register before login existed), preserving the
// attempted destination so the login can send them back there.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return null
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
