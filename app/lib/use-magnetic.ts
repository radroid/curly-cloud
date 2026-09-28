'use client'

import { useCallback } from 'react'
import { motionOff } from './motion'

const MAX_PX = 6

/**
 * M15 magnetic button: the element leans up to 6 px toward a mouse pointer moving over it and
 * springs back when it leaves. Mouse only (touch and pen never move it), off when motion is off or
 * the element is disabled. It sets the `translate` property, so give the element a short
 * `transition-[translate]` and don't use Tailwind translate utilities on it.
 */
export function useMagnetic<T extends HTMLElement>(): React.RefCallback<T> {
  return useCallback((el: T | null) => {
    if (!el) return
    let frame = 0
    const put = (x: number, y: number): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.translate = x || y ? `${x.toFixed(1)}px ${y.toFixed(1)}px` : ''
      })
    }
    const clamp = (v: number): number => Math.max(-MAX_PX, Math.min(MAX_PX, v))
    const move = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || motionOff() || el.matches(':disabled')) return put(0, 0)
      const r = el.getBoundingClientRect()
      put(clamp((e.clientX - r.left - r.width / 2) * 0.2), clamp((e.clientY - r.top - r.height / 2) * 0.3))
    }
    const leave = (): void => put(0, 0)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      el.style.translate = ''
    }
  }, [])
}
