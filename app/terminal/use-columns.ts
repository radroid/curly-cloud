'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'

/** Text for the hidden probe span; its width divided by its length is one monospace cell. */
export const COLUMN_PROBE = '0'.repeat(40)

/**
 * How many monospace characters fit across the output column. Re-measured when the column resizes
 * or the web font swaps in (the probe changes size). Returns a stable getter for the shell host.
 */
export function useColumns(
  columnRef: RefObject<HTMLElement | null>,
  probeRef: RefObject<HTMLElement | null>,
): () => number {
  const columnsRef = useRef(80)

  useEffect(() => {
    const column = columnRef.current
    const probe = probeRef.current
    if (!column || !probe) return
    const measure = (): void => {
      const cell = probe.getBoundingClientRect().width / COLUMN_PROBE.length
      if (cell > 0) columnsRef.current = Math.max(20, Math.floor(column.clientWidth / cell))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    observer.observe(probe)
    return () => observer.disconnect()
  }, [columnRef, probeRef])

  return useCallback(() => columnsRef.current, [])
}
