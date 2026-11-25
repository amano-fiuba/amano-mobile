import { useEffect, useState } from 'react'
import { me } from '../api/authClient'
import { preferredCurrency } from '../validation/expenseValidation'
import useCurrentDate from './useCurrentDate'

export const PROFILE_FALLBACK_NOTICE =
  'No se pudo cargar tu moneda preferida. Se usa ARS.'

/**
 * Defaults shared by the personal registration screens (new expense, 007/027, and new
 * income, 033): today's date of the device zone preloaded by `useCurrentDate` and the
 * profile currency resolved with me(). Any unreadable profile falls back to ARS; only
 * a network/5xx failure sets the non-blocking `notice` (a 401 is handled by
 * ProtectedRoute). The currency select lists the profile currencies first (027,
 * FR-011).
 */
export default function usePersonalFormDefaults() {
  const { today } = useCurrentDate()
  const [currency, setCurrency] = useState('ARS')
  const [preferred, setPreferred] = useState(['ARS'])
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    me().then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        const currencies = Array.isArray(result.profile?.currencies) ? result.profile.currencies : []
        setCurrency(preferredCurrency(currencies))
        if (currencies.length > 0) {
          setPreferred(currencies)
        }
      } else if (result.network) {
        setNotice(PROFILE_FALLBACK_NOTICE)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { today, currency, preferred, notice }
}
