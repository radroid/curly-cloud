'use client'

import { useSyncExternalStore } from 'react'

// The hero cloud's render line ("high, 60 fps"). The hero writes it; the clone status card on the Ask
// panel's avatar reads it. A store rather than context, so the fps tick re-renders only the card.
let status = '…'
const listeners = new Set<() => void>()

export function setRenderStatus(next: string): void {
  if (next === status) return
  status = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The hero cloud's render status, e.g. `high, 60 fps` or `saver, static`. */
export function useRenderStatus(): string {
  return useSyncExternalStore(subscribe, () => status, () => '…')
}
