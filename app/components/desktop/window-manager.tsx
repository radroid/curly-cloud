'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Rect } from './app-registry'
import { APP_MAP } from './app-registry'

export type WindowState = {
  appId: string
  position: { x: number; y: number } // percentage of container (0–1)
  zIndex: number
  isOpen: boolean
  fromOrigin?: Rect // clicked-icon rect relative to CRT screen, px
  openedAt: number // timestamp for "first open" checks and animation keys
  size?: { width: number; height: number } // pixel override when user resizes
  isFullscreen?: boolean
  // Dynamic window metadata (for windows not in APP_REGISTRY, e.g. Finder previews)
  title?: string
  dynamicSize?: { width: number; height: number }
  dynamicResizable?: boolean
  content?: React.ReactNode
}

type WindowsRecord = Record<string, WindowState>

type OpenWindowConfig = {
  title: string
  size: { width: number; height: number }
  resizable?: boolean
  content: React.ReactNode
}

type WindowManagerContextType = {
  windows: WindowsRecord
  activeWindowId: string | null
  selectedIconId: string | null
  hasOpenedAnyApp: boolean
  openApp: (appId: string, fromOrigin?: Rect) => void
  closeApp: (appId: string) => void
  focusApp: (appId: string) => void
  selectIcon: (appId: string | null) => void
  moveWindow: (appId: string, pos: { x: number; y: number }) => void
  resizeWindow: (appId: string, size: { width: number; height: number }) => void
  toggleFullscreen: (appId: string) => void
  openWindow: (windowId: string, config: OpenWindowConfig) => void
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null)

const BASE_POS = { x: 0.12, y: 0.14 }
const CASCADE_STEP = 0.03

function nextCascadePosition(topmost: WindowState | null) {
  if (!topmost) return { ...BASE_POS }
  let x = topmost.position.x + CASCADE_STEP
  let y = topmost.position.y + CASCADE_STEP
  // Clamp: if cascade goes too far right or too far down, wrap back
  if (x > 0.55 || y > 0.50) {
    x = BASE_POS.x
    y = BASE_POS.y
  }
  return { x, y }
}

function countOpen(windows: WindowsRecord) {
  let n = 0
  for (const id in windows) if (windows[id].isOpen) n++
  return n
}

function topmost(windows: WindowsRecord): WindowState | null {
  let top: WindowState | null = null
  for (const id in windows) {
    const w = windows[id]
    if (!w.isOpen) continue
    if (!top || w.zIndex > top.zIndex) top = w
  }
  return top
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowsRecord>({})
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null)
  const [hasOpenedAnyApp, setHasOpenedAnyApp] = useState(false)

  const activeWindowId = useMemo(() => topmost(windows)?.appId ?? null, [windows])

  const openApp = useCallback((appId: string, fromOrigin?: Rect) => {
    if (!APP_MAP[appId]) return
    setHasOpenedAnyApp(true)
    setWindows((prev) => {
      const existing = prev[appId]
      if (existing && existing.isOpen) {
        // Already open → focus it
        return focusReshuffle(prev, appId)
      }
      const count = countOpen(prev)
      const position = nextCascadePosition(topmost(prev))
      const next: WindowsRecord = { ...prev }
      next[appId] = {
        appId,
        position,
        zIndex: count,
        isOpen: true,
        fromOrigin,
        openedAt: Date.now(),
      }
      return next
    })
  }, [])

  const closeApp = useCallback((appId: string) => {
    setWindows((prev) => {
      const target = prev[appId]
      if (!target || !target.isOpen) return prev
      const closedZ = target.zIndex
      const next: WindowsRecord = {}
      for (const id in prev) {
        if (id === appId) continue
        const w = prev[id]
        next[id] = w.zIndex > closedZ ? { ...w, zIndex: w.zIndex - 1 } : w
      }
      return next
    })
  }, [])

  const focusApp = useCallback((appId: string) => {
    setWindows((prev) => focusReshuffle(prev, appId))
  }, [])

  const selectIcon = useCallback((appId: string | null) => {
    setSelectedIconId(appId)
  }, [])

  const moveWindow = useCallback(
    (appId: string, pos: { x: number; y: number }) => {
      setWindows((prev) => {
        const w = prev[appId]
        if (!w) return prev
        return { ...prev, [appId]: { ...w, position: pos, fromOrigin: undefined } }
      })
    },
    [],
  )

  const resizeWindow = useCallback(
    (appId: string, size: { width: number; height: number }) => {
      setWindows((prev) => {
        const w = prev[appId]
        if (!w) return prev
        return { ...prev, [appId]: { ...w, size } }
      })
    },
    [],
  )

  const toggleFullscreen = useCallback((appId: string) => {
    setWindows((prev) => {
      const w = prev[appId]
      if (!w) return prev
      return { ...prev, [appId]: { ...w, isFullscreen: !w.isFullscreen } }
    })
  }, [])

  const openWindow = useCallback((windowId: string, config: OpenWindowConfig) => {
    setWindows((prev) => {
      const existing = prev[windowId]
      if (existing && existing.isOpen) {
        return focusReshuffle(prev, windowId)
      }
      const count = countOpen(prev)
      const position = nextCascadePosition(topmost(prev))
      return {
        ...prev,
        [windowId]: {
          appId: windowId,
          position,
          zIndex: count,
          isOpen: true,
          openedAt: Date.now(),
          title: config.title,
          dynamicSize: config.size,
          dynamicResizable: config.resizable ?? true,
          content: config.content,
        },
      }
    })
  }, [])

  const value: WindowManagerContextType = {
    windows,
    activeWindowId,
    selectedIconId,
    hasOpenedAnyApp,
    openApp,
    closeApp,
    focusApp,
    selectIcon,
    moveWindow,
    resizeWindow,
    toggleFullscreen,
    openWindow,
  }

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>
}

function focusReshuffle(prev: WindowsRecord, appId: string): WindowsRecord {
  const target = prev[appId]
  if (!target || !target.isOpen) return prev
  const count = countOpen(prev)
  if (target.zIndex === count - 1) return prev // already on top
  const next: WindowsRecord = {}
  for (const id in prev) {
    const w = prev[id]
    if (!w.isOpen) {
      next[id] = w
      continue
    }
    if (id === appId) {
      next[id] = { ...w, zIndex: count - 1 }
    } else if (w.zIndex > target.zIndex) {
      next[id] = { ...w, zIndex: w.zIndex - 1 }
    } else {
      next[id] = w
    }
  }
  return next
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext)
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider')
  return ctx
}
