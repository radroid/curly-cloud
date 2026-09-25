'use client'

import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/** Mirror view state into the URL without a server round trip (Next syncs with the history API). */
export function useUrlState(params: Record<string, string | number | boolean | null | undefined>): void {
  const key = JSON.stringify(params)
  useEffect(() => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) sp.set(k, String(v))
    const next = `${window.location.pathname}${sp.toString() ? `?${sp}` : ''}`
    if (next !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, '', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
