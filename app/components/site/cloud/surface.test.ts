import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_STARS } from './stars'
import { pickStars, POINTS } from './sampler'
import { cameraAt, readSurface, visibleFrom, type Surface } from './surface'

const binary = Uint8Array.from(readFileSync('public/models/raj-cloud.bin')).buffer
const surface = readSurface(binary)

describe('reconstructed portrait assets', () => {
  it('has a complete surface and enough deterministic samples for both render tiers', () => {
    const { points: p, vertices: v, indices: f } = surface
    expect(p.count).toBe(POINTS.high)
    expect(p.count).toBeGreaterThan(POINTS.medium)
    expect(f.length % 3).toBe(0)
    expect(v.length / 3).toBeLessThan(65536)
    expect(Math.min(...p.z)).toBeLessThan(-.15)
    expect(Math.max(...p.z)).toBeGreaterThan(.22)
    for (let i = 0; i < p.count; i++) expect(Math.hypot(p.nx[i], p.ny[i], p.nz[i])).toBeCloseTo(1, 4)
  })

  it('models the nose forward of the adjacent cheeks, not on one rounded image plane', () => {
    const { points: p } = surface
    const depthNear = (x: number, y: number): number => {
      let best = -Infinity
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.x[i] - x, p.y[i] - y) < .014) best = Math.max(best, p.z[i])
      return best
    }
    const nose = depthNear(.025, -.064)
    expect(nose).toBeGreaterThan(.22)
    expect(nose - depthNear(-.10, -.064)).toBeGreaterThan(.035)
    expect(nose - depthNear(.12, -.064)).toBeGreaterThan(.035)
  })

  it('exports the same geometry in the colored GLB, with a self-contained texture', () => {
    const glb = Uint8Array.from(readFileSync('public/models/raj-bust.glb')).buffer
    const h = new DataView(glb)
    expect(h.getUint32(0, true)).toBe(0x46546c67)
    expect(h.getUint32(4, true)).toBe(2)
    expect(h.getUint32(8, true)).toBe(glb.byteLength)
    const length = h.getUint32(12, true)
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, length)))
    const a = json.accessors[json.meshes[0].primitives[0].attributes.POSITION]
    const view = json.bufferViews[a.bufferView]
    const positions = new Float32Array(glb, 28 + length + view.byteOffset, a.count * 3)
    expect(positions.length).toBe(surface.vertices.length)
    for (let i = 0; i < positions.length; i++) expect(positions[i]).toBeCloseTo(surface.vertices[i] * (i % 3 === 1 ? -1 : 1), 4)
    expect(json.images[0].bufferView).toBeTypeOf('number')
    expect(json.images[0].uri).toBeUndefined()
    expect(json.materials).toHaveLength(2)
  })

  it('keeps all work and personal stars on front surfaces available in Medium', () => {
    const stars = pickStars(surface.points, ALL_STARS.length)
    expect(new Set(stars).size).toBe(ALL_STARS.length)
    for (const i of stars) {
      expect(i).toBeLessThan(POINTS.medium)
      expect(surface.points.nz[i]).toBeGreaterThan(.45)
    }
    expect(stars).toEqual(pickStars(readSurface(binary).points, ALL_STARS.length))
  })

  it('draws the eyes densely enough to read in both tiers, with no star over them', () => {
    const { points: p } = surface
    // Each eye's lash line and iris in model units (x0, x1, y0, y1). Before the emphasis they held about 60 bright points.
    const eyes = [[-.080, -.014, -.166, -.145], [.055, .118, -.164, -.143]]
    const gap = (i: number, [x0, x1, y0, y1]: number[]): number => Math.hypot(Math.max(x0 - p.x[i], 0, p.x[i] - x1), Math.max(y0 - p.y[i], 0, p.y[i] - y1))
    for (const eye of eyes) {
      let high = 0
      let medium = 0
      for (let i = 0; i < p.count; i++) {
        if (gap(i, eye) > 0 || p.b[i] < .9) continue
        high++
        if (i < POINTS.medium) medium++
      }
      expect(high).toBeGreaterThan(250)
      expect(medium).toBeGreaterThan(200)
    }
    for (const i of pickStars(p, ALL_STARS.length)) for (const eye of eyes) expect(gap(i, eye)).toBeGreaterThan(.03)
  })

  it('rejects missing, truncated and out-of-range geometry before touching WebGL', () => {
    expect(() => readSurface(new ArrayBuffer(0))).toThrow('Invalid portrait surface')
    expect(() => readSurface(binary.slice(0, -1))).toThrow('Incomplete portrait surface')
    const broken = binary.slice(0)
    new DataView(broken).setUint16(broken.byteLength - 2, 65535, true)
    expect(() => readSurface(broken)).toThrow('Invalid portrait mesh')
  })
})

it('does not allow picking a front-facing star hidden behind another surface', () => {
  const scene: Surface = {
    points: { count: 1, x: new Float32Array([0]), y: new Float32Array([0]), z: new Float32Array([0]),
      nx: new Float32Array([0]), ny: new Float32Array([0]), nz: new Float32Array([1]), b: new Float32Array([1]) },
    vertices: new Float32Array([-1, -1, .2, 1, -1, .2, 0, 1, .2]),
    indices: new Uint16Array([0, 1, 2]),
  }
  expect(visibleFrom(scene, 0, cameraAt(0, 0))).toBe(false)
  scene.points.z[0] = .2
  expect(visibleFrom(scene, 0, cameraAt(0, 0))).toBe(true)
  expect(visibleFrom(scene, 0, cameraAt(Math.PI, 0))).toBe(false)
})
