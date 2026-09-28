'use client'

import { useEffect, useState } from 'react'

/**
 * The current time in a time zone, like "2:32 p.m.", refreshed on the minute. Null on the server
 * and before hydration, so give the slot a reserved width to avoid a layout shift.
 */
export function useLocalTime(timeZone = 'America/Toronto'): string | null {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', minute: '2-digit' })
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const now = new Date()
      setTime(fmt.format(now))
      timer = setTimeout(tick, 60_000 - (now.getTime() % 60_000) + 50)
    }
    tick()
    return () => clearTimeout(timer)
  }, [timeZone])

  return time
}
