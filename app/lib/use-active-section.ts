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

// One scroll listener for every subscriber. The current section is the last one whose top has
// passed the middle of the viewport, so between nav sections (profile, how-it-works) the one above
// holds. Measured from positions rather than crossings, so a jump (a citation, a deep link, reduced
// motion) that skips a section still lands on the right label.
let active = NAV_SECTIONS[0].id
let frame = 0
const listeners = new Set<() => void>()

function measure(): string {
  let id = NAV_SECTIONS[0].id
  for (const s of NAV_SECTIONS) {
    const top = document.getElementById(s.id)?.getBoundingClientRect().top
    if (top !== undefined && top <= innerHeight / 2) id = s.id
  }
  return id
}

function update(): void {
  frame = 0
  const next = measure()
  if (next === active) return
  active = next
  for (const l of listeners) l()
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(update)
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  if (listeners.size === 1) {
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule, { passive: true })
    schedule()
  }
  return () => {
    listeners.delete(onChange)
    if (!listeners.size) {
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
      frame = 0
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
