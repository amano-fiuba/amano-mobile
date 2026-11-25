import { useEffect, useRef, useState } from 'react'

// Current day of the DEVICE time zone (FR-009), formatted as dd/mm/aaaa. The
// form keeps its own dirty guard, exposed here as `shouldUpdate`, so crossing
// midnight refreshes the preloaded date only when the user has not edited it
// (US1-12). A 30 s interval plus visibilitychange covers both a form left open
// and a tab resumed after sleeping.
export const UPDATE_INTERVAL_MS = 30000

const alwaysUpdate = () => true

/** IANA zone of the device, with a defensive UTC fallback. */
export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** dd/mm/aaaa of the current instant in the given IANA zone. */
export function currentDateIn(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const value = (type) => parts.find((part) => part.type === type)?.value
    return `${value('day')}/${value('month')}/${value('year')}`
  } catch {
    const now = new Date()
    return [
      String(now.getDate()).padStart(2, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      now.getFullYear(),
    ].join('/')
  }
}

export default function useCurrentDate({
  timeZone = deviceTimeZone(),
  shouldUpdate = alwaysUpdate,
} = {}) {
  const [today, setToday] = useState(() => currentDateIn(timeZone))
  const shouldUpdateRef = useRef(shouldUpdate)

  useEffect(() => {
    shouldUpdateRef.current = shouldUpdate
  }, [shouldUpdate])

  useEffect(() => {
    const refresh = () => {
      if (shouldUpdateRef.current()) {
        setToday(currentDateIn(timeZone))
      }
    }
    refresh()
    const interval = setInterval(refresh, UPDATE_INTERVAL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [timeZone])

  return { today, timeZone }
}
