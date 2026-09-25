'use client'

import { useEffect, useState } from 'react'
import { fmtDateTime, timeAgo } from '@/lib/studio/shared'

/**
 * Relative time with the full local date on hover. Server and browser disagree on "now" and on
 * the time zone, so the first client render may differ from the HTML: suppress that warning and
 * re-render once mounted so the browser's values win.
 */
export function When({ at, className }: { at: number | null | undefined; className?: string }) {
  const [, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <time suppressHydrationWarning dateTime={at ? new Date(at).toISOString() : undefined} title={fmtDateTime(at)} className={className}>
      {timeAgo(at)}
    </time>
  )
}
