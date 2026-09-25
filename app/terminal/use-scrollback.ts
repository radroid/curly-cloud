'use client'

import { useCallback, useRef, useState } from 'react'
import { appendToLines, type Line, type Segment } from '@/lib/shell'

/** Oldest lines drop off past this, like a terminal's scrollback limit. */
const MAX_LINES = 2000
const NEWLINE: Segment = { text: '\n' }

export interface ScrollbackView {
  lines: readonly Line[]
  /** Stable React keys, parallel to `lines`. A line keeps its id while it streams. */
  ids: readonly number[]
}

export interface Scrollback {
  view: ScrollbackView
  /** Queue segments; they reach the screen on the next animation frame. */
  write(segments: Segment[]): void
  /** Apply queued segments now (before echoing input or showing a prompt). */
  flush(): void
  /** Close the open line if it has text, so the next write starts on a fresh line. */
  newlineIfOpen(): void
  clear(): void
}

/**
 * The terminal's output buffer. Streamed writes are batched into one state update per frame, folded
 * into lines by `appendToLines` (which keeps unchanged lines identical, so memoised rows skip work).
 * All returned functions are stable.
 */
export function useScrollback(): Scrollback {
  const [view, setView] = useState<ScrollbackView>({ lines: [], ids: [] })
  const linesRef = useRef<Line[]>([])
  const idsRef = useRef<number[]>([])
  const nextIdRef = useRef(0)
  const pendingRef = useRef<Segment[]>([])
  const frameRef = useRef<number | null>(null)

  const flush = useCallback((): void => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const pending = pendingRef.current
    if (!pending.length) return
    pendingRef.current = []
    let lines = appendToLines(linesRef.current, pending)
    let ids = idsRef.current.slice()
    // The open last line is replaced in place (same index, same id); anything past it is new.
    for (let i = ids.length; i < lines.length; i++) ids.push(nextIdRef.current++)
    if (lines.length > MAX_LINES) {
      lines = lines.slice(-MAX_LINES)
      ids = ids.slice(-MAX_LINES)
    }
    linesRef.current = lines
    idsRef.current = ids
    setView({ lines, ids })
  }, [])

  const write = useCallback(
    (segments: Segment[]): void => {
      if (!segments.length) return
      for (const segment of segments) pendingRef.current.push(segment)
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null
          flush()
        })
      }
    },
    [flush],
  )

  const newlineIfOpen = useCallback((): void => {
    flush()
    const last = linesRef.current[linesRef.current.length - 1]
    if (last && last.length) {
      write([NEWLINE])
      flush()
    }
  }, [flush, write])

  const clear = useCallback((): void => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingRef.current = []
    linesRef.current = []
    idsRef.current = []
    setView({ lines: [], ids: [] })
  }, [])

  return { view, write, flush, newlineIfOpen, clear }
}
