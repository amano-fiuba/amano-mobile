import { useEffect, useState } from 'react'

function currentMatch(query) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

// True while `query` matches; follows changes (rotating the phone, resizing).
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => currentMatch(query))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined
    }
    const list = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)
    list.addEventListener?.('change', handleChange)
    return () => list.removeEventListener?.('change', handleChange)
  }, [query])

  return matches
}
