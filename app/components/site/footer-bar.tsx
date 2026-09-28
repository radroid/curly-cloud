'use client'

import { useEffect, useState } from 'react'
import { RESUME } from '@/content/resume'
import { useLocalTime } from '@/app/lib/use-local-time'

/** Whether any of the elements with these ids is on screen. */
function useAnyInView(ids: string[]): boolean {
  const key = ids.join(' ')
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const els = key
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (!els.length || typeof IntersectionObserver === 'undefined') return
    const seen = new Set<Element>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.add(e.target)
        else seen.delete(e.target)
      }
      setInView(seen.size > 0)
    })
    for (const el of els) io.observe(el)
    return () => io.disconnect()
  }, [key])
  return inView
}

/**
 * C17 (desktop). A quiet "say hello" pill at the bottom-left of the reading column, shown while
 * neither the hero nor Contact is on screen. On mobile the same things live in the dock menu.
 */
export function FooterBar(): React.ReactNode {
  const hidden = useAnyInView(['home', 'contact'])
  const time = useLocalTime()
  return (
    <div
      inert={hidden}
      className={[
        'fixed bottom-4 left-gutter z-30 hidden items-center gap-[18px] rounded-full border border-rule bg-paper/88 py-2 pl-4 pr-2 text-[13.5px] shadow-[0_10px_30px_-18px_rgb(0_0_0/0.4)] backdrop-blur-[10px] transition-[opacity,translate] duration-300 lg:flex print:hidden',
        hidden ? 'pointer-events-none translate-y-3 opacity-0' : '',
      ].join(' ')}
    >
      <span className="text-muted">Say hello</span>
      <a
        href={`mailto:${RESUME.email}`}
        className="font-mono text-[13px] underline decoration-current/45 decoration-1 underline-offset-4 hover:decoration-current"
      >
        {RESUME.email}
      </a>
      <span className="pr-2 font-mono text-[13px] text-muted">
        Toronto <span className="inline-block min-w-[10ch] tabular-nums">{time ?? '--:--'}</span>
      </span>
    </div>
  )
}
