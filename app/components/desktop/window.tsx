'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useWindowManager } from './window-manager'
import type { AppDefinition } from './app-registry'

const DRAG_THRESHOLD_PX = 5
const OPEN_ANIM_MS = 220

type WindowProps = {
  app?: AppDefinition
  windowId: string
  containerRef: RefObject<HTMLDivElement | null>
  prefersReduced: boolean
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export function Window({ app, windowId, containerRef, prefersReduced }: WindowProps) {
  const { windows, activeWindowId, closeApp, focusApp, moveWindow, resizeWindow, toggleFullscreen } = useWindowManager()
  const state = windows[windowId]
  const windowRef = useRef<HTMLDivElement>(null)
  const [contentReady, setContentReady] = useState(false)
  const [openAnimPlayed, setOpenAnimPlayed] = useState(false)
  // True for exactly one render after a drag commit — skips left/top
  // transitions so the final position snaps in without a ghost animation.
  const [skipTransition, setSkipTransition] = useState(false)

  const isActive = activeWindowId === windowId

  // Zoom-from-origin: first render shows the window at the clicked-icon rect,
  // then after a double raf we flip to the normal position so CSS transitions
  // the delta. prefers-reduced-motion skips the animation entirely.
  const atOrigin = !!state?.fromOrigin && !openAnimPlayed && !prefersReduced
  useLayoutEffect(() => {
    if (!atOrigin) return
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(() => setOpenAnimPlayed(true)))
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
    if (prefersReduced) { setContentReady(true); return }
    const t = setTimeout(() => setContentReady(true), OPEN_ANIM_MS + 20)
    return () => clearTimeout(t)
  }, [prefersReduced])

  // Clamp position so the window stays within the container bounds.
  // Runs once after mount (when CSS clamp() sizes have resolved) and
  // adjusts the position if the window overflows right or bottom.
  useLayoutEffect(() => {
    const el = windowRef.current
    const container = containerRef.current
    if (!el || !container || !state?.isOpen || state.isFullscreen) return
    // Wait a frame so CSS clamp() sizes have resolved
    const raf = requestAnimationFrame(() => {
      const cRect = container.getBoundingClientRect()
      const wRect = el.getBoundingClientRect()
      if (cRect.width === 0 || cRect.height === 0) return
      const { x, y } = state.position
      const maxX = Math.max(0, 1 - wRect.width / cRect.width)
      const maxY = Math.max(0, 1 - wRect.height / cRect.height)
      if (x > maxX || y > maxY) {
        setSkipTransition(true)
        moveWindow(windowId, { x: Math.min(x, maxX), y: Math.min(y, maxY) })
      }
    })
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.isOpen, state?.openedAt])

  // Drag wiring — direct DOM `transform` manipulation during drag so the
  // window tracks the cursor 1:1 without going through React state. Only
  // the final position is committed via moveWindow on mouseup.
  useEffect(() => {
    const el = windowRef.current
    if (!el) return
    const titleBar = el.querySelector<HTMLDivElement>('[data-window-titlebar]')
    if (!titleBar) return

    let dragging = false, started = false
    let startClientX = 0, startClientY = 0
    let containerRect = { left: 0, top: 0, width: 0, height: 0 }
    let startLeftPx = 0, startTopPx = 0, elWidthPx = 0, elHeightPx = 0
    let rafId = 0, pendingTx = 0, pendingTy = 0

    const applyTransform = () => {
      rafId = 0
      el.style.transform = `translate3d(${pendingTx}px, ${pendingTy}px, 0)`
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('[data-window-close]') || target.closest('[data-window-fullscreen]')) return
      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()
      containerRect = { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height }
      startLeftPx = eRect.left - cRect.left
      startTopPx = eRect.top - cRect.top
      elWidthPx = eRect.width
      elHeightPx = eRect.height
      startClientX = e.clientX
      startClientY = e.clientY
      pendingTx = 0
      pendingTy = 0
      dragging = true
      started = false
      // Disable CSS transitions while dragging so tracking is 1:1
      el.style.transition = 'none'
      focusApp(windowId)
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
      if (!rafId) rafId = requestAnimationFrame(applyTransform)
    }

    const onUp = () => {
      if (!dragging) return
      dragging = false
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      // Clear the inline transform so the next render isn't offset by it.
      el.style.transform = ''
      if (started && containerRect.width > 0 && containerRect.height > 0) {
        // Skip transition for one render so the commit is atomic with the DOM's current visual position.
        setSkipTransition(true)
        moveWindow(windowId, {
          x: (startLeftPx + pendingTx) / containerRect.width,
          y: (startTopPx + pendingTy) / containerRect.height,
        })
      } else {
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
  }, [windowId, containerRef, focusApp, moveWindow])

  // Resize wiring — similar pattern to drag, but adjusts size + position
  useEffect(() => {
    const el = windowRef.current
    if (!el) return
    const resizable = app ? app.resizable !== false : (state?.dynamicResizable ?? true)
    if (!resizable) return

    const handles = el.querySelectorAll<HTMLDivElement>('[data-resize-edge]')
    if (handles.length === 0) return

    let resizing = false
    let edge: ResizeEdge = 's'
    let startClientX = 0, startClientY = 0
    let containerRect = { left: 0, top: 0, width: 0, height: 0 }
    let startLeftPx = 0, startTopPx = 0, startWidthPx = 0, startHeightPx = 0
    let currentWidthPx = 0, currentHeightPx = 0, currentLeftPx = 0, currentTopPx = 0
    let rafId = 0

    const minW = app?.minSize?.width ?? 150
    const minH = app?.minSize?.height ?? 100

    const applyResize = () => {
      rafId = 0
      el.style.width = `${currentWidthPx}px`
      el.style.height = `${currentHeightPx}px`
      // If top or left edge is being dragged, translate the window
      const dx = currentLeftPx - startLeftPx
      const dy = currentTopPx - startTopPx
      if (dx !== 0 || dy !== 0) {
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      }
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      const edgeAttr = target.getAttribute('data-resize-edge') as ResizeEdge | null
      if (!edgeAttr) return

      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const eRect = el.getBoundingClientRect()

      edge = edgeAttr
      containerRect = { left: cRect.left, top: cRect.top, width: cRect.width, height: cRect.height }
      startLeftPx = eRect.left - cRect.left
      startTopPx = eRect.top - cRect.top
      startWidthPx = eRect.width
      startHeightPx = eRect.height
      currentWidthPx = startWidthPx
      currentHeightPx = startHeightPx
      currentLeftPx = startLeftPx
      currentTopPx = startTopPx
      startClientX = e.clientX
      startClientY = e.clientY
      resizing = true

      el.style.transition = 'none'
      focusApp(windowId)
      e.preventDefault()
      e.stopPropagation()
    }

    const onMove = (e: MouseEvent) => {
      if (!resizing) return
      const dx = e.clientX - startClientX
      const dy = e.clientY - startClientY

      let newW = startWidthPx, newH = startHeightPx, newLeft = startLeftPx, newTop = startTopPx

      // Compute new dimensions based on which edge/corner is being dragged
      if (edge.includes('e')) newW = Math.min(Math.max(minW, startWidthPx + dx), containerRect.width - startLeftPx)
      if (edge.includes('w')) {
        newLeft = Math.max(0, startLeftPx + Math.min(dx, startWidthPx - minW))
        newW = startWidthPx + (startLeftPx - newLeft)
      }
      if (edge.includes('s')) newH = Math.min(Math.max(minH, startHeightPx + dy), containerRect.height - startTopPx)
      if (edge.includes('n')) {
        newTop = Math.max(0, startTopPx + Math.min(dy, startHeightPx - minH))
        newH = startHeightPx + (startTopPx - newTop)
      }

      if (app?.maxSize) {
        newW = Math.min(newW, app.maxSize.width)
        newH = Math.min(newH, app.maxSize.height)
      }

      currentWidthPx = newW
      currentHeightPx = newH
      currentLeftPx = newLeft
      currentTopPx = newTop
      if (!rafId) rafId = requestAnimationFrame(applyResize)
    }

    const onUp = () => {
      if (!resizing) return
      resizing = false
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
      el.style.transform = ''
      el.style.width = ''
      el.style.height = ''

      if (containerRect.width > 0 && containerRect.height > 0) {
        setSkipTransition(true)
        resizeWindow(windowId, { width: currentWidthPx, height: currentHeightPx })
        if (currentLeftPx !== startLeftPx || currentTopPx !== startTopPx) {
          moveWindow(windowId, { x: currentLeftPx / containerRect.width, y: currentTopPx / containerRect.height })
        }
      } else {
        el.style.transition = ''
      }
    }

    handles.forEach((h) => h.addEventListener('mousedown', onDown))
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      handles.forEach((h) => h.removeEventListener('mousedown', onDown))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [windowId, app?.resizable, app?.minSize, app?.maxSize, containerRef, focusApp, moveWindow, resizeWindow])

  if (!state || !state.isOpen) return null

  // Determine width/height — fullscreen > user resize > default
  const isFullscreen = !!state.isFullscreen
  const hasUserSize = !!state.size

  // Default size: app registry clamp() string, or dynamic px size
  const defaultWidth = app ? app.defaultSize.width : `${state.dynamicSize?.width ?? 400}px`
  const defaultHeight = app ? app.defaultSize.height : `${state.dynamicSize?.height ?? 300}px`

  const normalStyle: React.CSSProperties = isFullscreen
    ? { inset: 0 }
    : {
        left: `${state.position.x * 100}%`,
        top: `${state.position.y * 100}%`,
        width: hasUserSize ? `${state.size!.width}px` : defaultWidth,
        height: hasUserSize ? `${state.size!.height}px` : defaultHeight,
      }

  const zoomStyle: React.CSSProperties = atOrigin && state.fromOrigin
    ? { left: state.fromOrigin.x, top: state.fromOrigin.y, width: state.fromOrigin.width, height: state.fromOrigin.height }
    : normalStyle

  const isResizable = app ? app.resizable !== false : (state.dynamicResizable ?? true)
  const showResizeHandles = isResizable && !isFullscreen

  return (
    <div
      ref={windowRef}
      role="dialog"
      aria-label={state.title ?? app?.name ?? windowId}
      onMouseDown={() => focusApp(windowId)}
      style={{
        position: 'absolute', boxSizing: 'border-box', background: '#fff', border: '1px solid #000',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-chicago)', color: '#000',
        zIndex: state.zIndex + 1, opacity: atOrigin ? 0.15 : 1,
        boxShadow: isActive ? '2px 2px 0 #000' : '1px 1px 0 #000',
        transition: skipTransition || prefersReduced ? 'none'
          : ['left', 'top', 'width', 'height', 'opacity'].map(p => `${p} ${OPEN_ANIM_MS}ms ease`).join(', '),
        ...zoomStyle,
      }}
    >
      {/* Title bar */}
      <div
        style={{ background: '#fff', borderBottom: '1px solid #000', padding: '3px 0', flexShrink: 0, userSelect: 'none' }}
      >
        <div
          data-window-titlebar
          style={{
            height: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: isFullscreen ? 'default' : 'grab',
            background: isActive ? titleBarActiveBg : '#fff',
            padding: '0 4px',
          }}
        >
          {/* Close box + fullscreen toggle */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <CloseButton onClose={() => closeApp(windowId)} />
            {app?.fullscreenable !== false && (
              <FullscreenButton
                isFullscreen={isFullscreen}
                onToggle={() => toggleFullscreen(windowId)}
              />
            )}
          </span>

          {/* Title text cuts a white hole in the stripes */}
          <span style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 0.3, background: '#fff', padding: '0 10px' }}>
            {state.title ?? app?.name ?? windowId}
          </span>

          {/* Transparent mirror spacer — same total width as left buttons
              so the title stays centered */}
          <span
            aria-hidden="true"
            style={{ width: app?.fullscreenable !== false ? 25 : 11, height: 11, flexShrink: 0, display: 'block' }}
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          overflow: app?.showScrollbar || state.content ? 'auto' : 'hidden',
        }}
      >
        {contentReady ? (state.content ?? (app && <app.component />)) : null}
      </div>

      {/* Optional status bar */}
      {app?.statusBar && (
        <div style={{ borderTop: '1px solid #000', padding: '3px 7px', fontSize: 11, background: '#f0f0f0', flexShrink: 0 }}>
          {app.statusBar}
        </div>
      )}

      {/* Resize handles */}
      {showResizeHandles && (
        <>
          {/* Edges */}
          <div data-resize-edge="n" style={{ ...resizeEdgeBase, top: -2, left: 4, right: 4, height: 5, cursor: 'n-resize' }} />
          <div data-resize-edge="s" style={{ ...resizeEdgeBase, bottom: -2, left: 4, right: 4, height: 5, cursor: 's-resize' }} />
          <div data-resize-edge="w" style={{ ...resizeEdgeBase, left: -2, top: 4, bottom: 4, width: 5, cursor: 'w-resize' }} />
          <div data-resize-edge="e" style={{ ...resizeEdgeBase, right: -2, top: 4, bottom: 4, width: 5, cursor: 'e-resize' }} />
          {/* Corners */}
          <div data-resize-edge="nw" style={{ ...resizeCornerBase, top: -2, left: -2, cursor: 'nw-resize' }} />
          <div data-resize-edge="ne" style={{ ...resizeCornerBase, top: -2, right: -2, cursor: 'ne-resize' }} />
          <div data-resize-edge="sw" style={{ ...resizeCornerBase, bottom: -2, left: -2, cursor: 'sw-resize' }} />
          <div data-resize-edge="se" style={{ ...resizeCornerBase, bottom: -2, right: -2, cursor: 'se-resize' }} />
        </>
      )}
    </div>
  )
}

const titleBarActiveBg = 'repeating-linear-gradient(to bottom, #000 0 1px, #fff 1px 2px)'

const resizeEdgeBase: React.CSSProperties = { position: 'absolute', zIndex: 10, background: 'transparent' }
const resizeCornerBase: React.CSSProperties = { position: 'absolute', width: 8, height: 8, zIndex: 11, background: 'transparent' }

const chromeButtonStyle: React.CSSProperties = {
  appearance: 'none', width: 11, height: 11, border: '1px solid #000',
  padding: 0, cursor: 'pointer', flexShrink: 0,
}

function CloseButton({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      data-window-close
      aria-label="Close"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{ ...chromeButtonStyle, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {hovered && (
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true" style={{ display: 'block' }}>
          <path d="M2 2 L7 7 M7 2 L2 7" stroke="#000" strokeWidth="1" strokeLinecap="square" />
        </svg>
      )}
    </button>
  )
}

function FullscreenButton({ isFullscreen, onToggle }: { isFullscreen: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-window-fullscreen
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{ ...chromeButtonStyle, background: isFullscreen ? '#000' : '#fff' }}
    />
  )
}
