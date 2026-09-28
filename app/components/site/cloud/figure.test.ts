import { describe, expect, it } from 'vitest'
import { layout, posterBox, type HeroBox } from './figure'

// Boxes measured on the prototype, with the figure it drew there.
const DESKTOP: HeroBox = { w: 1440, h: 900, top: 70, copyTop: 404.2, copyRight: 604.16, logLeft: 1116 }
const MOBILE: HeroBox = { w: 390, h: 844, top: 70, copyTop: 477.33, copyRight: 370, logLeft: 390 }

describe('figure layout', () => {
  it('fits the bust between the copy and the log on a 1440 × 900 desktop', () => {
    const l = layout(DESKTOP)
    expect(l.s).toBeCloseTo(610.3, 0)
    expect(l.cx).toBeCloseTo(933.3, 0)
    expect(l.cy).toBeCloseTo(594.8, 0)
  })

  it('stands the bust on the bottom edge, between the copy and the log', () => {
    const l = layout(DESKTOP)
    expect(l.cy + l.s / 2).toBeCloseTo(DESKTOP.h)
    expect(l.cx - l.s * 0.5).toBeGreaterThanOrEqual(DESKTOP.copyRight + 24 - 0.01)
    expect(l.cx + l.s * 0.26).toBeLessThanOrEqual(DESKTOP.logLeft - 24 + 0.01)
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
    const l = layout({ w: 1024, h: 768, top: 70, copyTop: 361, copyRight: 585, logLeft: 716 })
    expect(l.cy + l.s * 0.54).toBeCloseTo(361 - 14)
    expect(l.s).toBeLessThan(768 * 0.5)
  })

  it('without the log, uses the full width to the right', () => {
    const l = layout({ ...DESKTOP, logLeft: DESKTOP.w })
    expect(l.cx + l.s * 0.5).toBeLessThanOrEqual(DESKTOP.w - 8 + 0.01)
  })

  it('sizes the poster to cover -0.6..0.6 of the figure', () => {
    const p = posterBox({ cx: 500, cy: 400, s: 200 })
    expect(p).toEqual({ x: 380, y: 280, size: 240 })
  })
})
