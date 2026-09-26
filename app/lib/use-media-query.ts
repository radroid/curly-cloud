'use client'

import { useEffect, useState } from 'react'

/** Tracks a media query. Returns `fallback` during SSR and the first client render. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const [matches, setMatches] = useState(fallback)
  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}
