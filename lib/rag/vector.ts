/** Vector helpers: Float32 BLOB encoding, cosine, top-k over a flat matrix, and RRF. */

export function normalize(v: ArrayLike<number>): Float32Array {
  const out = new Float32Array(v.length)
  let norm = 0
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm
  return out
}

/** L2-normalised Float32 bytes for a D1 BLOB column. */
export function encodeVector(v: ArrayLike<number>): Uint8Array {
  const f = normalize(v)
  return new Uint8Array(f.buffer, f.byteOffset, f.byteLength)
}

/**
 * Decode a BLOB from D1. D1 has returned BLOBs as ArrayBuffer and, in some runtimes, as an array
 * of byte values; accept both plus typed-array views.
 */
export function decodeVector(blob: unknown): Float32Array | null {
  let bytes: Uint8Array | null = null
  if (blob instanceof ArrayBuffer) bytes = new Uint8Array(blob)
  else if (ArrayBuffer.isView(blob)) bytes = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength)
  else if (Array.isArray(blob)) bytes = Uint8Array.from(blob as number[])
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength % 4 !== 0) return null
  // Copy so the Float32Array is aligned regardless of the source offset.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Float32Array(copy.buffer)
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/** Rows are unit vectors stored back to back; the query is normalised here. Returns best first. */
export function topKByCosine(
  matrix: Float32Array,
  dim: number,
  query: ArrayLike<number>,
  k: number,
): { index: number; score: number }[] {
  if (query.length !== dim || dim === 0) return []
  const q = normalize(query)
  const rows = Math.floor(matrix.length / dim)
  const scored: { index: number; score: number }[] = []
  for (let r = 0; r < rows; r++) {
    let dot = 0
    const off = r * dim
    for (let i = 0; i < dim; i++) dot += matrix[off + i] * q[i]
    scored.push({ index: r, score: dot })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}

export interface Fused {
  id: string
  score: number
  /** 1-based rank in each input list, or null when absent. */
  ranks: (number | null)[]
}

/** Reciprocal Rank Fusion: score = Σ 1 / (k + rank). Ties keep first-seen order. */
export function rrf(lists: string[][], k = 60): Fused[] {
  const byId = new Map<string, Fused>()
  const order: string[] = []
  lists.forEach((list, li) => {
    const seen = new Set<string>()
    list.forEach((id, i) => {
      if (seen.has(id)) return
      seen.add(id)
      let f = byId.get(id)
      if (!f) {
        f = { id, score: 0, ranks: lists.map(() => null) }
        byId.set(id, f)
        order.push(id)
      }
      f.ranks[li] = i + 1
      f.score += 1 / (k + i + 1)
    })
  })
  const pos = new Map(order.map((id, i) => [id, i]))
  return [...byId.values()].sort((a, b) => b.score - a.score || (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
}
