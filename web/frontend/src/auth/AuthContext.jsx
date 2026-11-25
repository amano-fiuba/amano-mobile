import { createContext, useContext, useEffect, useState } from 'react'
import { apiUrl } from '../api/apiBase'

// Session store shared across pages (task T015; FR-016, FR-021, SC-002).
// While the story-1 API client does not exist yet, the session is fetched
// directly with fetch (credentials: 'include' sends the HttpOnly cookie).
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch(apiUrl('/api/users/me'), { credentials: 'include' })
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(`session check failed: ${response.status}`)),
      )
      .then((profile) => {
        if (!cancelled) setUser(profile)
      })
      .catch(() => {
        // Sin sesión (401/cookie inválida) o fallo de red: no hay usuario.
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// Colocated on purpose (provider + hook live together, like the task specifies).
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
