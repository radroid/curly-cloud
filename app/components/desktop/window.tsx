'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useWindowManager } from './window-manager'
import type { AppDefinition } from './app-registry'

const DRAG_THRESHOLD_PX = 5
const OPEN_ANIM_MS = 220

type WindowProps = {
  app: AppDefinition
  containerRef: RefObject<HTMLDivElement | null>
  prefersReduced: boolean
}

export function Window({ app, containerRef, prefersReduced }: WindowProps) {
  const { windows, activeWindowId, closeApp, focusApp, moveWindow } = useWindowManager()
  const state = windows[app.id]
  const windowRef = useRef<HTMLDivElement>(null)
  const [contentReady, setContentReady] = useState(false)
  const [openAnimPlayed, setOpenAnimPlayed] = useState(false)
  // True for exactly one render after a drag commit — skips left/top
  // transitions so the final position snaps in without a ghost animation.
  const [skipTransition, setSkipTransition] = useState(false)

  const isActive = activeWindowId === app.id

  // Zoom-from-origin: first render shows the window at the clicked-icon rect,
  // then after a double raf we flip to the normal position so CSS transitions
  // the delta. prefers-reduced-motion skips the animation entirely.
  const atOrigin = !!state?.fromOrigin && !openAnimPlayed && !prefersReduced
  useLayoutEffect(() => {
    if (!atOrigin) return
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpenAnimPlayed(true))
    })
    return () => cancelAnimationFrame(raf1)
  }, [atOrigin])

  // Re-enable transitions one frame after a drag commit
  useLayoutEffect(() => {
    if (!skipTransition) return
    const raf = requestAnimationFrame(() => setSkipTransition(false))
    return () => cancelAnimationFrame(raf)
  }, [skipTransition])

  // Lazy content mount after entry animation completes
  useEffect(() => {
    if (prefersReduced) {
      setContentReady(true)
      return
    }
    const t = setTimeout(() => setContentReady(true), OPEN_ANIM_MS + 20)
    return () => clearTimeout(t)
  }, [prefersReduced])

  // Drag wiring — direct DOM `transform` manipulation during drag so the
  // window tracks the cursor 1:1 without going through React state. Only
  // the final position is committed via moveWindow on mouseup.
  useEffect(() => {
    const el = windowRef.current
    if (!el) return
    const titleBar = el.querySelector<HTMLDivElement>('[data-window-titlebar]')
    if (!titleBar) return

    let dragging = false
    let started = false
    let startClientX = 0
    let startClientY = 0
    let containerRect = { left: 0, top: 0, width: 0, height: 0 }
    let startLeftPx = 0
    let startTopPx = 0
    let elWidthPx = 0
    let elHeightPx = 0
    let lastTx = 0
    let lastTy = 0
    let rafId = 0
    let pendingTx = 0
    let pendingTy = 0

    const applyTransform = () => {
      rafId = 0
      el.style.transform = `translate3d(${pendingTx}px, ${pendingTy}px, 0)`
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-window-close]')) return
      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      containerRect = {
        left: cRect.left,
        top: cRect.top,
        width: cRect.width,
        height: cRect.height,
      }
      startLeftPx = eRect.left - cRect.left
      startTopPx = eRect.top - cRect.top
      elWidthPx = eRect.width
      elHeightPx = eRect.height
      startClientX = e.clientX
      startClientY = e.clientY
      lastTx = 0
      lastTy = 0
      dragging = true
      started = false
      // Disable CSS transitions while dragging so tracking is 1:1
      el.style.transition = 'none'
      focusApp(app.id)
      e.preventDefault()
    }

    const onMove = (e: MouseEvent) => {
      if (!dragging) return
      const dx = e.clientX - startClientX
      const dy = e.clientY - startClientY
      if (!started && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      started = true
      const maxDx = containerRect.width - elWidthPx - startLeftPx
      const minDx = -startLeftPx
      const maxDy = containerRect.height - elHeightPx - startTopPx
      const minDy = -startTopPx
      pendingTx = Math.min(Math.max(dx, minDx), maxDx)
      pendingTy = Math.min(Math.max(dy, minDy), maxDy)
      lastTx = pendingTx
      lastTy = pendingTy
      if (!rafId) rafId = requestAnimationFrame(applyTransform)
    }

    const onUp = () => {
      if (!dragging) return
      dragging = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      // Clear the inline transform so the next render isn't offset by it.
      el.style.transform = ''
      if (started && containerRect.width > 0 && containerRect.height > 0) {
        const newX = (startLeftPx + lastTx) / containerRect.width
        const newY = (startTopPx + lastTy) / containerRect.height
        // Skip transition for one render so the commit is atomic with the
        // DOM's current visual position — no snap-back or ghost animation.
        setSkipTransition(true)
        moveWindow(app.id, { x: newX, y: newY })
      } else {
        // Click without movement — restore transitions for any future changes.
        el.style.transition = ''
      }
      started = false
    }

    titleBar.addEventListener('mousedown', onDown)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      titleBar.removeEventListener('mousedown', onDown)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [app.id, containerRef, focusApp, moveWindow])

  if (!state || !state.isOpen) return null

  const normalStyle: React.CSSProperties = {
    left: `${state.position.x * 100}%`,
    top: `${state.position.y * 100}%`,
    width: app.defaultSize.width,
    height: app.defaultSize.height,
  }

  const zoomStyle: React.CSSProperties = atOrigin && state.fromOrigin
    ? {
        left: state.fromOrigin.x,
        top: state.fromOrigin.y,
        width: state.fromOrigin.width,
        height: state.fromOrigin.height,
      }
    : normalStyle

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label={app.name}
      onMouseDown={() => focusApp(app.id)}
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-chicago)',
        color: '#000',
        zIndex: state.zIndex + 1,
        opacity: atOrigin ? 0.15 : 1,
        transition:
          skipTransition || prefersReduced
            ? 'none'
            : `left ${OPEN_ANIM_MS}ms ease, top ${OPEN_ANIM_MS}ms ease, width ${OPEN_ANIM_MS}ms ease, height ${OPEN_ANIM_MS}ms ease, opacity ${OPEN_ANIM_MS}ms ease`,
        boxShadow: isActive ? '2px 2px 0 #000' : '1px 1px 0 #000',
        ...zoomStyle,
      }}
    >
      {/* Title bar — outer provides the white top/bottom inset around the
         active-state stripes. Inner row carries the stripes as a background
         image; the flex padding-left/right pushes the close box and spacer
         a few px inward, but the stripes fill the padding area too (because
         background-image extends through padding), so the pattern reaches
         the window edge on both sides. Matches the Mac OS 1 reference. */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #000',
          padding: '3px 0',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        <div
          data-window-titlebar
          style={{
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'grab',
            background: isActive ? titleBarActiveBg : '#fff',
            padding: '0 4px',
          }}
        >
          {/* Close box — opaque white, sits on top of the stripes */}
          <button
            type="button"
            data-window-close
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation()
              closeApp(app.id)
            }}
            style={{
              appearance: 'none',
              width: 11,
              height: 11,
              background: '#fff',
              border: '1px solid #000',
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 9 9"
              aria-hidden="true"
              style={{ display: 'block' }}
            >
              <path
                d="M2 2 L7 7 M7 2 L2 7"
                stroke="#000"
                strokeWidth="1"
                strokeLinecap="square"
              />
            </svg>
          </button>

          {/* Title text cuts a white hole in the stripes */}
          <span
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              letterSpacing: 0.3,
              background: '#fff',
              padding: '0 10px',
            }}
          >
            {app.name}
          </span>

          {/* Transparent mirror spacer — no background so stripes show through,
             same width as close box so the title stays centered */}
          <span
            aria-hidden="true"
            style={{ width: 11, height: 11, flexShrink: 0, display: 'block' }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: app.showScrollbar ? 'auto' : 'hidden',
        }}
      >
        {contentReady ? <app.component /> : null}
      </div>

      {/* Optional status bar */}
      {app.statusBar && (
        <div
          style={{
            borderTop: '1px solid #000',
            padding: '3px 7px',
            fontSize: 11,
            background: '#f0f0f0',
            flexShrink: 0,
          }}
        >
          {app.statusBar}
        </div>
      )}
    </div>
  )
}

const titleBarActiveBg = 'repeating-linear-gradient(to bottom, #000 0 1px, #fff 1px 2px)'
