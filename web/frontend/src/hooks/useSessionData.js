import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

// Loads one independent section of the main screen. `load` must be stable and
// follow the { ok, status, ... } convention of the API clients; `field` names the
// list in its result. A 401 closes the session and any other failure stays
// inside the section (specs/015-main-screen).
export function useSessionData(load, field) {
  const { setUser } = useAuth()
  const [state, setState] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    let cancelled = false
    load().then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setState({ status: 'ready', items: result[field] })
      } else if (result.status === 401) {
        setUser(null)
      } else {
        setState({ status: 'error', items: [] })
      }
    })
    return () => {
      cancelled = true
    }
  }, [load, field, setUser])

  return [state, setState]
}
