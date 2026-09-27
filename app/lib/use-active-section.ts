'use client'

import { useSyncExternalStore } from 'react'

/** The bracket nav shared by the top bar and the mobile dock: `[1] HOME` … `[5] CONTACT`. */
export const NAV_SECTIONS: { id: string; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'work', label: 'Work' },
  { id: 'fit', label: 'Fit' },
  { id: 'agents', label: 'Agents' },
  { id: 'contact', label: 'Contact' },
]

// One observer for every subscriber. A section is current once it crosses a thin band just above
// the middle of the viewport; between nav sections (profile, how-it-works) the last one holds.
let active = NAV_SECTIONS[0].id
let io: IntersectionObserver | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (!io && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting)
        if (!hit || hit.target.id === active) return
        active = hit.target.id
        for (const l of listeners) l()
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (const s of NAV_SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    }
  }
  return () => {
    listeners.delete(onChange)
    if (!listeners.size) {
      io?.disconnect()
      io = null
    }
  }
}

/** Scroll-spy: the id of the nav section being read (`home` on the server). */
export function useActiveSection(): string {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => NAV_SECTIONS[0].id,
  )
}
