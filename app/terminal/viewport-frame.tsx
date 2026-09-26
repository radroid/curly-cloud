'use client'

import { useEffect, useState, type ReactNode } from 'react'

interface VisibleBox {
  height: number
  top: number
}

/**
 * Tracks the visual viewport, which shrinks when the on-screen keyboard opens (iOS doesn't resize
 * the layout viewport or `dvh`). Null until measured, and while pinch-zoomed.
 */
function useVisibleBox(): VisibleBox | null {
  const [box, setBox] = useState<VisibleBox | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    let frame = 0
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // Pinch-zoomed: let the page zoom normally instead of shrinking the terminal to the zoomed area.
        if (Math.abs(viewport.scale - 1) > 0.01) return setBox(null)
        const height = Math.round(viewport.height)
        const top = Math.round(viewport.offsetTop)
        setBox((prev) => (prev && prev.height === height && prev.top === top ? prev : { height, top }))
      })
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return box
}

/** A fixed full-screen frame that stays inside the visible area, so the input and chips sit above the keyboard. */
export function ViewportFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  const box = useVisibleBox()
  return (
    <div
      className={`fixed inset-x-0 top-0 h-dvh ${className}`}
      style={box ? { height: box.height, transform: box.top ? `translateY(${box.top}px)` : undefined } : undefined}
    >
      {children}
    </div>
  )
}
