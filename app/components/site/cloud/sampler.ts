/**
 * Legacy image sampler (kept for rebuilding the original illustration assets). The live hero now
 * loads the shared 3D mesh samples from surface.ts; rng, scatter and pickStars are shared.
 *
 * The original curly cloud's point set, sampled from `public/hero-cloud-src.png` (REDESIGN-PLAN.md §4): a line
 * sketch of Raj's cartoon, made by `scripts/portrait-images.py`. Pure and seeded, so the same image always
 * gives the same cloud and the same stars. Ported from the prototype's `sample()`, `depth()` and
 * `pickStars()`; the weights were tuned in review.
 *
 * Coordinates are normalised: x and y in -0.5..0.5 of the figure's size `s`, y down, z towards
 * the viewer.
 */

/** Side of the source image, in pixels. */
export const SRC_SIZE = 320

/** Points per render tier. Medium draws the first 8,000 of the same set. */
export const POINTS = { high: 18000, medium: 8000 } as const

export interface PointSet {
  x: Float32Array
  y: Float32Array
  z: Float32Array
  /** 1 on dark ink (outlines, hair, beard), 0.55 elsewhere. */
  b: Float32Array
  count: number
  /** Present on the reconstructed mesh; absent on the legacy image sampler. */
  nx?: Float32Array
  ny?: Float32Array
  nz?: Float32Array
}

/** Where each point starts before the assembly, and how long it waits. */
export interface Scatter {
  x: Float32Array
  y: Float32Array
  z: Float32Array
  /** Delay before the point starts moving, in ms. */
  delay: Float32Array
  /** The longest delay, so the renderer knows when the assembly has finished. */
  maxDelay: number
}

/** Mulberry32: a small seeded PRNG in 0..1. */
export function rng(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Ellipse = readonly [cx: number, cy: number, rx: number, ry: number]

// Two ellipsoids fitted to the source image: the head (with hair and beard) and the shoulders.
const HEAD: Ellipse = [0, -0.18, 0.26, 0.31]
const BODY: Ellipse = [0, 0.52, 0.62, 0.5]

/** > 0 inside the ellipse, 1 at its centre. */
function inside(e: Ellipse, x: number, y: number): number {
  const u = (x - e[0]) / e[2]
  const v = (y - e[1]) / e[3]
  return 1 - u * u - v * v
}

/** Depth of the figure at (x, y): the head bulges more than the shoulders. */
export function depth(x: number, y: number): number {
  const h = inside(HEAD, x, y)
  const b = inside(BODY, x, y)
  return Math.max(h > 0 ? Math.sqrt(h) * 0.24 : 0, b > 0 ? Math.sqrt(b) * 0.15 : 0)
}

/**
 * Sample `count` points from RGBA pixels (row-major, `size`²). The alpha channel is the figure
 * mask. Points follow edges on √luminance (so curls in the hair show and the faint shirt print
 * doesn't), solid dark fill is down-weighted so the hair and beard don't swallow the budget, and
 * the head gets more points than the shoulders.
 */
export function sample(rgba: ArrayLike<number>, size = SRC_SIZE, count: number = POINTS.high, seed = 7): PointSet {
  const n = size * size
  const lum = new Float32Array(n)
  const fig = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    fig[i] = rgba[i * 4 + 3] > 128 ? 1 : 0
    // The background reads as paper white, so the outline keeps its edge.
    lum[i] = fig[i] ? (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255 : 1
  }
  const e = lum.map(Math.sqrt)
  const cdf = new Float32Array(n)
  let acc = 0
  for (let i = 0; i < n; i++) {
    const x = i % size
    const y = (i / size) | 0
    let wt = 0
    if (fig[i] && x > 0 && y > 0 && x < size - 1 && y < size - 1) {
      const l = lum[i]
      const edge = Math.min(1, Math.max(0, Math.abs(e[i + 1] - e[i - 1]) + Math.abs(e[i + size] - e[i - size]) - 0.09) * 3.4)
      wt = (l < 0.3 ? 0.28 : 0.02 + 0.3 * (1 - l)) + edge * 2.8
      wt *= inside(HEAD, (x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) > 0 ? 1.5 : 0.7
    }
    acc += wt
    cdf[i] = acc
  }
  const r = rng(seed)
  const out: PointSet = { x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count), b: new Float32Array(count), count }
  for (let k = 0; k < count; k++) {
    const t = r() * acc
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cdf[mid] < t) lo = mid + 1
      else hi = mid
    }
    const px = lo % size
    const py = (lo / size) | 0
    out.x[k] = (px + r()) / size - 0.5
    out.y[k] = (py + r()) / size - 0.5
    out.z[k] = depth(out.x[k], out.y[k]) + (r() - 0.5) * 0.02
    out.b[k] = lum[lo] < 0.3 ? 1 : 0.55
  }
  return out
}

/**
 * Pick `n` stars: points on the dark outline (full brightness; the model draws the eyes and their
 * surroundings just under it, so no star covers one), above the faded bottom rows, each as far
 * as possible from the ones already chosen (best of 300 random candidates). Only the first `pool`
 * points are candidates, so every tier shows the same stars. Returns point indices.
 */
export function pickStars(points: PointSet, n: number, seed = 11, pool: number = POINTS.medium): number[] {
  const outline: number[] = []
  for (let i = 0; i < Math.min(pool, points.count); i++) if (points.b[i] === 1 && points.y[i] < 0.30 && (!points.nz || points.nz[i] > 0.45)) outline.push(i)
  if (!outline.length) return []
  const r = rng(seed)
  const chosen: number[] = []
  for (let s = 0; s < n; s++) {
    let best = -1
    let bestD = -1
    for (let c = 0; c < 300; c++) {
      const i = outline[(r() * outline.length) | 0]
      let md = 1e9
      for (const j of chosen) {
        const dx = points.x[i] - points.x[j]
        const dy = points.y[i] - points.y[j]
        md = Math.min(md, dx * dx + dy * dy)
      }
      if (md > bestD) {
        bestD = md
        best = i
      }
    }
    chosen.push(best)
  }
  return chosen
}

/** Start positions on a loose shell around the figure; points near the centre leave first. */
export function scatter(points: PointSet, seed = 3): Scatter {
  const r = rng(seed)
  const n = points.count
  const out: Scatter = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), delay: new Float32Array(n), maxDelay: 0 }
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    const u = r() * 2 - 1
    const rad = 0.7 + r() * 0.8
    const s = Math.sqrt(1 - u * u)
    out.x[i] = Math.cos(a) * s * rad
    out.y[i] = u * rad * 0.7
    out.z[i] = Math.sin(a) * s * rad * 0.5
    out.delay[i] = r() * 420 + Math.hypot(points.x[i], points.y[i]) * 600
    out.maxDelay = Math.max(out.maxDelay, out.delay[i])
  }
  return out
}
