'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 32

export interface StickToBottom {
  /** Jump to the newest output and keep following it. */
  follow(): void
  onScroll(): void
}

/**
 * Keep the log pinned to the bottom while output streams, unless the visitor scrolls up to read.
 * Only an upward scroll unpins: content growing under a programmatic scroll can't unpin by accident.
 */
export function useStickToBottom(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
): StickToBottom {
  const stuckRef = useRef(true)
  const lastTopRef = useRef(0)

  const toBottom = useCallback((): void => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scrollRef])

  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    const observer = new ResizeObserver(() => {
      if (stuckRef.current) toBottom()
    })
    observer.observe(content)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRef, contentRef, toBottom])

  const onScroll = useCallback((): void => {
    const el = scrollRef.current
    if (!el) return
    const top = el.scrollTop
    if (el.scrollHeight - top - el.clientHeight <= NEAR_BOTTOM_PX) stuckRef.current = true
    else if (top < lastTopRef.current) stuckRef.current = false
    lastTopRef.current = top
  }, [scrollRef])

  const follow = useCallback((): void => {
    stuckRef.current = true
    toBottom()
  }, [toBottom])

  return { follow, onScroll }
}
