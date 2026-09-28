import { describe, expect, it } from 'vitest'
import { depth, pickStars, POINTS, rng, sample, scatter } from './sampler'
import { ALL_STARS, STARS } from './stars'

/** A stand-in for the illustration: a light disc with a dark outline on a transparent background. */
function disc(size = 320): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2, y - size / 2)
      if (d > 120) continue
      const v = d > 112 ? 30 : 230
      px.set([v, v, v, 255], (y * size + x) * 4)
    }
  }
  return px
}

describe('cloud sampler', () => {
  const points = sample(disc())

  it('samples the High count, inside the figure', () => {
    expect(points.count).toBe(POINTS.high)
    for (let i = 0; i < points.count; i++) expect(Math.hypot(points.x[i], points.y[i])).toBeLessThan(122 / 320) // the disc plus a pixel of jitter
  })

  it('is deterministic for a seed', () => {
    const again = sample(disc())
    expect(Array.from(again.x.slice(0, 50))).toEqual(Array.from(points.x.slice(0, 50)))
    expect(Array.from(sample(disc(), 320, 100, 8).x)).not.toEqual(Array.from(points.x.slice(0, 100)))
  })

  it('weights the dark outline over the flat fill', () => {
    const ink = Array.from(points.b).filter((b) => b === 1).length
    // The ring is about an eighth of the disc's area but gets most of the points.
    expect(ink / points.count).toBeGreaterThan(0.5)
  })

  it('bulges the head towards the viewer', () => {
    expect(depth(0, -0.18)).toBeCloseTo(0.24)
    expect(depth(0.49, -0.49)).toBe(0)
  })
})

describe('source stars', () => {
  const points = sample(disc())

  it('picks one star per public source, each a distinct point', () => {
    const stars = pickStars(points, STARS.length)
    expect(stars).toHaveLength(STARS.length)
    expect(new Set(stars).size).toBe(STARS.length)
  })

  it('puts stars on the outline, above the faded bottom rows, from points every tier draws', () => {
    for (const i of pickStars(points, STARS.length)) {
      expect(points.b[i]).toBe(1)
      expect(points.y[i]).toBeLessThan(0.38)
      expect(i).toBeLessThan(POINTS.medium)
    }
  })

  it('is deterministic for a seed', () => {
    expect(pickStars(points, STARS.length)).toEqual(pickStars(points, STARS.length))
    expect(pickStars(points, STARS.length, 12)).not.toEqual(pickStars(points, STARS.length))
  })

  it('spreads the stars out', () => {
    const stars = pickStars(points, STARS.length)
    let closest = Infinity
    for (const a of stars) for (const b of stars) if (a !== b) closest = Math.min(closest, Math.hypot(points.x[a] - points.x[b], points.y[a] - points.y[b]))
    // Evenly spaced on this ring they'd be about 0.05 apart.
    expect(closest).toBeGreaterThan(0.02)
  })

  it('still spreads them out with the personal dots added', () => {
    const stars = pickStars(points, ALL_STARS.length)
    expect(new Set(stars).size).toBe(ALL_STARS.length)
    // The work stars come first and are the same picks as without the personal dots.
    expect(stars.slice(0, STARS.length)).toEqual(pickStars(points, STARS.length))
    let closest = Infinity
    for (const a of stars) for (const b of stars) if (a !== b) closest = Math.min(closest, Math.hypot(points.x[a] - points.x[b], points.y[a] - points.y[b]))
    expect(closest).toBeGreaterThan(0.015)
  })
})

describe('scatter', () => {
  it('delays each point by up to about a second, centre first', () => {
    const points = sample(disc(), 320, 500)
    const s = scatter(points)
    expect(s.maxDelay).toBeLessThan(420 + 0.71 * 600)
    expect(Math.max(...s.delay)).toBe(s.maxDelay)
  })

  it('rng is a stable sequence in 0..1', () => {
    const a = rng(7)
    const b = rng(7)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
