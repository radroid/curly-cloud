'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { APP_MAP, type Rect } from './app-registry'

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
  const x = topmost.position.x + CASCADE_STEP
  const y = topmost.position.y + CASCADE_STEP
  // Wrap back to BASE if cascade goes too far right or down
  return x > 0.55 || y > 0.50 ? { ...BASE_POS } : { x, y }
}

function openWindowsList(windows: WindowsRecord) {
  return Object.values(windows).filter((w) => w.isOpen)
}

function countOpen(windows: WindowsRecord) {
  return openWindowsList(windows).length
}

function topmost(windows: WindowsRecord): WindowState | null {
  return openWindowsList(windows).reduce<WindowState | null>(
    (top, w) => (!top || w.zIndex > top.zIndex ? w : top),
    null,
  )
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
      if (prev[appId]?.isOpen) return focusReshuffle(prev, appId)
      return {
        ...prev,
        [appId]: {
          appId, position: nextCascadePosition(topmost(prev)), zIndex: countOpen(prev),
          isOpen: true, fromOrigin, openedAt: Date.now(),
        },
      }
    })
  }, [])

  const closeApp = useCallback((appId: string) => {
    setWindows((prev) => {
      const target = prev[appId]
      if (!target?.isOpen) return prev
      const next: WindowsRecord = {}
      for (const id in prev) {
        if (id === appId) continue
        const w = prev[id]
        next[id] = w.zIndex > target.zIndex ? { ...w, zIndex: w.zIndex - 1 } : w
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

  const moveWindow = useCallback((appId: string, pos: { x: number; y: number }) => {
    setWindows((prev) =>
      prev[appId] ? { ...prev, [appId]: { ...prev[appId], position: pos, fromOrigin: undefined } } : prev
    )
  }, [])

  const resizeWindow = useCallback((appId: string, size: { width: number; height: number }) => {
    setWindows((prev) => (prev[appId] ? { ...prev, [appId]: { ...prev[appId], size } } : prev))
  }, [])

  const toggleFullscreen = useCallback((appId: string) => {
    setWindows((prev) =>
      prev[appId] ? { ...prev, [appId]: { ...prev[appId], isFullscreen: !prev[appId].isFullscreen } } : prev
    )
  }, [])

  const openWindow = useCallback((windowId: string, config: OpenWindowConfig) => {
    setWindows((prev) => {
      if (prev[windowId]?.isOpen) return focusReshuffle(prev, windowId)
      return {
        ...prev,
        [windowId]: {
          appId: windowId,
          position: nextCascadePosition(topmost(prev)), zIndex: countOpen(prev),
          isOpen: true, openedAt: Date.now(),
          title: config.title, dynamicSize: config.size,
          dynamicResizable: config.resizable ?? true, content: config.content,
        },
      }
    })
  }, [])

  const value: WindowManagerContextType = {
    windows, activeWindowId, selectedIconId, hasOpenedAnyApp,
    openApp, closeApp, focusApp, selectIcon,
    moveWindow, resizeWindow, toggleFullscreen, openWindow,
  }

  return <WindowManagerContext.Provider value={value}>{children}</WindowManagerContext.Provider>
}

function focusReshuffle(prev: WindowsRecord, appId: string): WindowsRecord {
  const target = prev[appId]
  if (!target?.isOpen) return prev
  const topZ = countOpen(prev) - 1
  if (target.zIndex === topZ) return prev
  const next: WindowsRecord = {}
  for (const id in prev) {
    const w = prev[id]
    if (!w.isOpen) next[id] = w
    else if (id === appId) next[id] = { ...w, zIndex: topZ }
    else if (w.zIndex > target.zIndex) next[id] = { ...w, zIndex: w.zIndex - 1 }
    else next[id] = w
  }
  return next
}

export function useWindowManager() {
  const ctx = useContext(WindowManagerContext)
  if (!ctx) throw new Error('useWindowManager must be used within WindowManagerProvider')
  return ctx
}
