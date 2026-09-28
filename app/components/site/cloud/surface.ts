import type { PointSet } from './sampler'

/** Offline samples and the exact surface they were sampled from. See docs/avatar/README.md. */
export interface Surface {
  points: PointSet & { nx: Float32Array; ny: Float32Array; nz: Float32Array }
  vertices: Float32Array
  indices: Uint16Array
}

/** RJC2: quantized xyz/normal/brightness, quantized vertices, uint16 indices. */
export function readSurface(data: ArrayBuffer): Surface {
  const header = new DataView(data)
  if (data.byteLength < 16 || header.getUint32(0, true) !== 0x32434a52) throw new Error('Invalid portrait surface')
  const count = header.getUint32(4, true)
  const vertices = header.getUint32(8, true)
  const indices = header.getUint32(12, true)
  if (!count || !vertices || vertices > 65535 || !indices || indices % 3 || 16 + count * 10 + vertices * 6 + indices * 2 !== data.byteLength) {
    throw new Error('Incomplete portrait surface')
  }
  const points = {
    count,
    x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count),
    nx: new Float32Array(count), ny: new Float32Array(count), nz: new Float32Array(count), b: new Float32Array(count),
  }
  for (let i = 0; i < count; i++) {
    const at = 16 + i * 10
    points.x[i] = header.getInt16(at, true) / 65534
    points.y[i] = header.getInt16(at + 2, true) / 65534
    points.z[i] = header.getInt16(at + 4, true) / 65534
    const nx = header.getInt8(at + 6), ny = header.getInt8(at + 7), nz = header.getInt8(at + 8)
    const length = Math.hypot(nx, ny, nz)
    if (!length) throw new Error('Invalid portrait normal')
    points.nx[i] = nx / length
    points.ny[i] = ny / length
    points.nz[i] = nz / length
    points.b[i] = header.getUint8(at + 9) / 255
  }
  const offset = 16 + count * 10
  const packed = new Int16Array(data, offset, vertices * 3)
  const mesh = Float32Array.from(packed, (v) => v / 65534)
  const triangles = new Uint16Array(data, offset + vertices * 6, indices)
  if (triangles.some((v) => v >= vertices)) throw new Error('Invalid portrait mesh')
  return { points, vertices: mesh, indices: triangles }
}

/** Camera in model space, the inverse of the renderer's yaw/pitch. */
export function cameraAt(yaw: number, pitch: number): [number, number, number] {
  return [-1.9 * Math.sin(yaw) * Math.cos(pitch), 1.9 * Math.sin(pitch), 1.9 * Math.cos(yaw) * Math.cos(pitch)]
}

/** Occluded stars must not be clickable. Called for hit candidates, never for every cloud point. */
export function visibleFrom(surface: Surface, i: number, camera: readonly number[]): boolean {
  const p = surface.points
  const ox = p.x[i], oy = p.y[i], oz = p.z[i]
  const dx = camera[0] - ox, dy = camera[1] - oy, dz = camera[2] - oz
  if (p.nx[i] * dx + p.ny[i] * dy + p.nz[i] * dz <= 0) return false
  const v = surface.vertices, f = surface.indices
  for (let k = 0; k < f.length; k += 3) {
    const a = f[k] * 3, b = f[k + 1] * 3, c = f[k + 2] * 3
    const ex = v[b] - v[a], ey = v[b + 1] - v[a + 1], ez = v[b + 2] - v[a + 2]
    const fx = v[c] - v[a], fy = v[c + 1] - v[a + 1], fz = v[c + 2] - v[a + 2]
    const hx = dy * fz - dz * fy, hy = dz * fx - dx * fz, hz = dx * fy - dy * fx
    const det = ex * hx + ey * hy + ez * hz
    if (Math.abs(det) < 1e-10) continue
    const sx = ox - v[a], sy = oy - v[a + 1], sz = oz - v[a + 2]
    const u = (sx * hx + sy * hy + sz * hz) / det
    if (u < 0 || u > 1) continue
    const qx = sy * ez - sz * ey, qy = sz * ex - sx * ez, qz = sx * ey - sy * ex
    const t = (fx * qx + fy * qy + fz * qz) / det
    const w = (dx * qx + dy * qy + dz * qz) / det
    if (w >= 0 && u + w <= 1 && t > .002 && t < 1) return false
  }
  return true
}
