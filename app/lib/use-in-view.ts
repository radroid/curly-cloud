'use client'

import { useCallback, useEffect, useState } from 'react'

export interface InViewOptions {
  /** Stop watching after the first time the element enters the viewport. */
  once?: boolean
  rootMargin?: string
  threshold?: number
}

/**
 * Whether an element is in the viewport. Attach the returned callback ref to the element.
 * Starts false (also on the server); without IntersectionObserver it reports true.
 */
export function useInView<T extends Element = HTMLElement>({ once = false, rootMargin, threshold = 0 }: InViewOptions = {}): [
  (el: T | null) => void,
  boolean,
] {
  const [el, setEl] = useState<T | null>(null)
  const [inView, setInView] = useState(false)
  const ref = useCallback((node: T | null) => setEl(node), [])

  useEffect(() => {
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (once && entry.isIntersecting) io.disconnect()
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [el, once, rootMargin, threshold])

  return [ref, inView]
}
