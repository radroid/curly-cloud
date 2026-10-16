'use client'

import { useEffect, useRef, useState } from 'react'

export type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'repeat'> & { target: EventTarget | null }

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/** A bare press of `key`: not while typing, not with a modifier (⌘C stays the browser's), once per hold. */
export function isShortcut(e: ShortcutEvent, key: string): boolean {
  if (e.key.toLowerCase() !== key || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return false
  const target = e.target as Element | null
  return !(target && typeof target.closest === 'function' && target.closest(EDITABLE))
}

/** Runs `onPress` on a bare press of `key` anywhere on the page. Returns whether the key is held. */
export function useKeyShortcut(key: string, onPress: () => void): boolean {
  const [held, setHeld] = useState(false)
  // Next 15 bundles a React without useEffectEvent, so keep the latest handler in a ref.
  const press = useRef(onPress)
  useEffect(() => {
    press.current = onPress
  }, [onPress])

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (!isShortcut(e, key)) return
      setHeld(true)
      press.current()
    }
    const up = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === key) setHeld(false)
    }
    const release = (): void => setHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
    }
  }, [key])

  return held
}
