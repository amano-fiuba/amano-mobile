import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { GROUP_DEBTS_LOAD_ERROR_MESSAGE } from '../../api/groupExpensesClient'

export const NOT_A_MEMBER_DEBTS_MESSAGE = 'No existe el grupo solicitado o no sos miembro'

/**
 * Loads one read of the debts screen (022 T074). `loader` must be stable
 * (useCallback) and resolve { ok, data } or a failure like the API clients do;
 * a new `refreshKey` reloads without flashing the "loading" state. A 401 closes
 * the session; any other failure becomes a voseo message and `retry` reloads.
 * Returns { status: 'loading' | 'ready' | 'error', data, error, retry }.
 */
export default function useGroupResource(loader, refreshKey = 0) {
  const setUser = useAuth()?.setUser
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [token, setToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    loader().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState({ status: 'ready', data: result.data ?? result.payments ?? null, error: '' })
        return
      }
      if (result.status === 401) {
        setUser?.(null)
        return
      }
      const message = result.network || result.status >= 500
        ? GROUP_DEBTS_LOAD_ERROR_MESSAGE
        : result.status === 404
          ? NOT_A_MEMBER_DEBTS_MESSAGE
          : result.detail || GROUP_DEBTS_LOAD_ERROR_MESSAGE
      setState({ status: 'error', data: null, error: message })
    })
    return () => {
      cancelled = true
    }
  }, [loader, refreshKey, token, setUser])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: '' })
    setToken((value) => value + 1)
  }, [])

  return { ...state, retry }
}
