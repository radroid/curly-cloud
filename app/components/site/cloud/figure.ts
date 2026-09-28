/**
 * Where the figure sits on the hero stage, fitted beside or above the copy so it never collides with
 * it (ported from the prototype's `layout()`). Pure: the hero measures the DOM and passes the numbers
 * in, and both the canvas and the poster use the result.
 */

/** Hero measurements in CSS px, relative to the hero's top-left corner. */
export interface HeroBox {
  /** Hero width and height. */
  w: number
  h: number
  /** Highest the figure may reach: just under the fixed top bar. */
  top: number
  /** Top of the copy block (name, prompt bar, disclosure, links). */
  copyTop: number
  /** Right edge of the copy's text and prompt bar. */
  copyRight: number
}

/** The figure's centre and size: normalised point (x, y) lands at (cx + x·s, cy + y·s), before perspective. */
export interface FigureLayout {
  cx: number
  cy: number
  s: number
}

/** Below this hero width the figure always sits above the copy (mobile). */
export const NARROW = 700

const GAP = 24

export function layout(b: HeroBox): FigureLayout {
  // The bust spans x -0.5..0.5 of s.
  const lb = b.copyRight + GAP
  const rb = b.w - 8
  // Standing on the hero's bottom edge, right of the copy...
  const s = Math.min(rb - lb, (b.h - b.top) / 0.98, b.h * 0.84)
  if (b.w >= NARROW && s >= b.h * 0.5) return { cx: (lb + rb) / 2, cy: b.h - s * 0.5, s }
  // ...or, where that leaves it under half the hero's height, above the copy. Perspective lifts the
  // hair to about -0.51 and sinks the faded hem to 0.54.
  const k = Math.min(b.w * 1.08, (b.copyTop - 14 - b.top) / 1.05)
  return { cx: Math.min(b.w * 0.5, rb - k * 0.5), cy: b.copyTop - 14 - k * 0.54, s: k }
}

/**
 * A figure narrower than this (CSS px) draws only the first part of its tier's points, so a phone keeps
 * the desktop's spacing instead of packing every point into a quarter of the area. The points are
 * stored in random order, so the part it draws thins the whole figure evenly.
 */
export const FULL_SIZE = 560

/** How many of a tier's `budget` points to draw for a figure of size `s`. */
export function pointsFor(budget: number, s: number): number {
  return Math.round(budget * Math.min(1, (s / FULL_SIZE) ** 2))
}

/** The poster covers normalised -0.6..0.6 around the figure's centre (room for perspective and drift). */
export const POSTER_SPAN = 1.2

/** The poster's square box for a layout: top-left corner and side, in CSS px. */
export function posterBox(l: FigureLayout): { x: number; y: number; size: number } {
  const size = l.s * POSTER_SPAN
  return { x: l.cx - size / 2, y: l.cy - size / 2, size }
}
