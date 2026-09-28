import { describe, expect, it } from 'vitest'
import { FULL_SIZE, layout, pointsFor, posterBox, type HeroBox } from './figure'

// Boxes measured on the prototype, with the figure it drew there.
const DESKTOP: HeroBox = { w: 1440, h: 900, top: 70, copyTop: 404.2, copyRight: 604.16 }
const MOBILE: HeroBox = { w: 390, h: 844, top: 70, copyTop: 477.33, copyRight: 370 }

describe('figure layout', () => {
  it('fills the space right of the copy on a 1440 × 900 desktop', () => {
    const l = layout(DESKTOP)
    expect(l.s).toBeCloseTo(756, 0)
    expect(l.cx).toBeCloseTo(1030.1, 0)
    expect(l.cy).toBeCloseTo(522, 0)
  })

  it('stands the bust on the bottom edge, between the copy and the right edge', () => {
    const l = layout(DESKTOP)
    expect(l.cy + l.s / 2).toBeCloseTo(DESKTOP.h)
    expect(l.cx - l.s * 0.5).toBeGreaterThanOrEqual(DESKTOP.copyRight + 24 - 0.01)
    expect(l.cx + l.s * 0.5).toBeLessThanOrEqual(DESKTOP.w - 8 + 0.01)
  })

  it('centres the bust above the copy on a 390 × 844 phone', () => {
    const l = layout(MOBILE)
    expect(l.s).toBeCloseTo(374.6, 0)
    expect(l.cx).toBeCloseTo(194.7, 0)
    expect(l.cy).toBeCloseTo(261.0, 0)
    // The faded hem ends 14 px above the name; the hair stays under the top bar.
    expect(l.cy + l.s * 0.54).toBeCloseTo(MOBILE.copyTop - 14)
    expect(l.cy - l.s * 0.51).toBeGreaterThanOrEqual(MOBILE.top)
  })

  it('moves above the copy where the gap beside it is too narrow', () => {
    const l = layout({ w: 900, h: 768, top: 70, copyTop: 361, copyRight: 585 })
    expect(l.cy + l.s * 0.54).toBeCloseTo(361 - 14)
    expect(l.s).toBeLessThan(768 * 0.5)
  })

  it('draws every point on a desktop and thins a phone figure to similar spacing', () => {
    expect(pointsFor(18000, layout(DESKTOP).s)).toBe(18000)
    expect(pointsFor(8000, FULL_SIZE)).toBe(8000)
    const phone = layout(MOBILE).s
    expect(pointsFor(8000, phone)).toBe(Math.round(8000 * (phone / FULL_SIZE) ** 2))
    // About 3,600 of Medium's 8,000: a phone default no longer packs them into a quarter of the area.
    expect(pointsFor(8000, phone)).toBeGreaterThan(3000)
    expect(pointsFor(8000, phone)).toBeLessThan(4000)
  })

  it('sizes the poster to cover -0.6..0.6 of the figure', () => {
    const p = posterBox({ cx: 500, cy: 400, s: 200 })
    expect(p).toEqual({ x: 380, y: 280, size: 240 })
  })
})
