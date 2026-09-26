/**
 * Ingest: upsert sources by id, skip unchanged content hashes, re-chunk and embed changed ones,
 * re-embed chunks whose embedding model is stale, optionally replace a whole kind, and bump
 * corpus_version. Per-source failures are reported in `errors[]`; the batch never throws for them.
 */
import { resumeSources } from '@/content/resume'
import { all, bumpCorpusVersion, now } from '@/lib/db'
import type { AppEnv } from '@/lib/env'
import { embed, embeddingModel } from '@/lib/llm'
import { chunkSource, contentHash, type ChunkDraft } from '@/lib/rag/chunk'
import { batches, deleteSourceRows, ID_BATCH } from '@/lib/rag/store'
import type { IngestResult, SourceInput, SourceKind } from '@/lib/rag/types'
import { encodeVector } from '@/lib/rag/vector'

export type IngestEnv = Pick<AppEnv, 'DB' | 'AI' | 'EMBEDDING_MODEL'>

export const MAX_SOURCES_PER_INGEST = 500
/** Stale-embedding repair is capped per call so one ingest can't run away. */
const MAX_REEMBED_PER_CALL = 2000

const KINDS: SourceKind[] = ['resume', 'profile', 'interview', 'note', 'correction']
const ID_PATTERN = /^[\w:.\-/@]{1,200}$/

export class IngestLimitError extends RangeError {
  constructor(count: number) {
    super(`At most ${MAX_SOURCES_PER_INGEST} sources per ingest call (got ${count}).`)
    this.name = 'IngestLimitError'
  }
}

/** Returns a cleaned copy or an error message. */
export function validateSourceInput(raw: SourceInput): SourceInput | string {
  if (!raw || typeof raw !== 'object') return 'Source must be an object.'
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return 'id must be 1–200 chars of letters, digits and : . - / @ _'
  if (!KINDS.includes(raw.kind)) return `kind must be one of ${KINDS.join(', ')}`
  if (raw.visibility !== 'public' && raw.visibility !== 'private') return 'visibility must be public or private'
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title || title.length > 500) return 'title is required (max 500 chars)'
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  if (!body) return 'body is required'
  if (body.length > 50_000) return 'body is too long (max 50,000 chars)'
  const topic = raw.topic == null || raw.topic === '' ? null : String(raw.topic).trim().slice(0, 60)
  const anchor = raw.anchor == null || raw.anchor === '' ? null : String(raw.anchor).trim().slice(0, 120)
  const meta = raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta) ? raw.meta : {}
  return { id: raw.id, kind: raw.kind, visibility: raw.visibility, title, topic, anchor, body, meta }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Embed texts in batches; a failed batch yields nulls rather than failing the whole call. */
async function embedAll(env: IngestEnv, texts: string[]): Promise<{ vectors: (number[] | null)[]; failed: boolean; error?: string }> {
  const vectors: (number[] | null)[] = []
  let failed = false
  let error: string | undefined
  for (const group of batches(texts, 50)) {
    try {
      vectors.push(...(await embed(env, group)))
    } catch (err) {
      failed = true
      error = err instanceof Error ? err.message : String(err)
      vectors.push(...group.map(() => null))
    }
  }
  return { vectors, failed, error }
}

interface Planned {
  source: SourceInput
  hash: string
  createdAt: number | null
  chunks: ChunkDraft[]
}

export async function ingestSources(
  env: IngestEnv,
  inputs: SourceInput[],
  opts: { replaceKind?: SourceKind } = {},
): Promise<IngestResult> {
  if (inputs.length > MAX_SOURCES_PER_INGEST) throw new IngestLimitError(inputs.length)
  const db = env.DB
  const model = embeddingModel(env)
  const result: IngestResult = { upserted: 0, unchanged: 0, deleted: 0, chunks: 0, embedded: 0, errors: [], corpusVersion: 0 }

  // 1. Validate, de-duplicate.
  const valid: SourceInput[] = []
  const seen = new Set<string>()
  const allIds = new Set<string>()
  for (const raw of inputs) {
    if (raw && typeof raw.id === 'string') allIds.add(raw.id)
    const checked = validateSourceInput(raw)
    if (typeof checked === 'string') {
      result.errors.push({ id: String(raw?.id ?? ''), message: checked })
      continue
    }
    if (seen.has(checked.id)) {
      result.errors.push({ id: checked.id, message: 'Duplicate id in this batch; the first copy was used.' })
      continue
    }
    seen.add(checked.id)
    valid.push(checked)
  }

  // 2. Compare hashes with what's stored.
  const existing = new Map<string, { hash: string; createdAt: number }>()
  for (const group of batches(valid.map((s) => s.id), ID_BATCH)) {
    const rows = await all<{ id: string; content_hash: string; created_at: number }>(
      db,
      `SELECT id, content_hash, created_at FROM sources WHERE id IN (${group.map(() => '?').join(', ')})`,
      ...group,
    )
    for (const r of rows) existing.set(r.id, { hash: r.content_hash, createdAt: Number(r.created_at) })
  }
  const planned: Planned[] = []
  for (const source of valid) {
    const hash = await contentHash(source)
    const prev = existing.get(source.id)
    if (prev && prev.hash === hash) {
      result.unchanged++
      continue
    }
    planned.push({ source, hash, createdAt: prev?.createdAt ?? null, chunks: chunkSource(source) })
  }

  // 3. Embed every new chunk up front, in batches.
  const drafts = planned.flatMap((p) => p.chunks)
  const { vectors, failed: embedFailed, error: embedError } = await embedAll(env, drafts.map((d) => d.text))
  const vectorById = new Map(drafts.map((d, i) => [d.id, vectors[i]]))

  // 4. Write each changed source atomically: upsert row, replace chunks.
  for (const p of planned) {
    const at = now()
    const s = p.source
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO sources (id, kind, visibility, title, topic, anchor, body, meta, content_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, visibility = excluded.visibility, title = excluded.title,
             topic = excluded.topic, anchor = excluded.anchor, body = excluded.body, meta = excluded.meta,
             content_hash = excluded.content_hash, updated_at = excluded.updated_at`,
        )
        .bind(s.id, s.kind, s.visibility, s.title, s.topic ?? null, s.anchor ?? null, s.body, JSON.stringify(s.meta ?? {}), p.hash, p.createdAt ?? at, at),
      db.prepare('DELETE FROM chunks WHERE source_id = ?').bind(s.id),
    ]
    let missing = 0
    for (const c of p.chunks) {
      const v = vectorById.get(c.id) ?? null
      if (!v) missing++
      statements.push(
        db
          .prepare('INSERT INTO chunks (id, source_id, ord, text, embedding, embedding_model, token_estimate) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(c.id, s.id, c.ord, c.text, v ? toArrayBuffer(encodeVector(v)) : null, v ? model : null, c.tokenEstimate),
      )
    }
    try {
      await db.batch(statements)
      result.upserted++
      result.chunks += p.chunks.length
      result.embedded += p.chunks.length - missing
      if (missing) {
        result.errors.push({ id: s.id, message: `Stored without embeddings (keyword search only): ${embedError ?? 'embedding failed'}` })
      }
    } catch (err) {
      result.errors.push({ id: s.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  // 5. Replace a whole kind: delete sources of that kind that weren't in this call.
  if (opts.replaceKind) {
    const rows = await all<{ id: string }>(db, 'SELECT id FROM sources WHERE kind = ?', opts.replaceKind)
    const stale = rows.map((r) => r.id).filter((id) => !allIds.has(id))
    if (stale.length) result.deleted = await deleteSourceRows(db, stale)
  }

  // 6. Re-embed chunks with no embedding or one from a different model (skip if AI is down).
  if (!embedFailed) result.embedded += await reembedStale(env, model)

  result.corpusVersion = await bumpCorpusVersion(db)
  return result
}

async function reembedStale(env: IngestEnv, model: string): Promise<number> {
  const rows = await all<{ id: string; text: string }>(
    env.DB,
    'SELECT id, text FROM chunks WHERE embedding IS NULL OR embedding_model IS NULL OR embedding_model <> ? LIMIT ?',
    model,
    MAX_REEMBED_PER_CALL,
  )
  if (!rows.length) return 0
  const { vectors } = await embedAll(env, rows.map((r) => r.text))
  const updates: D1PreparedStatement[] = []
  rows.forEach((r, i) => {
    const v = vectors[i]
    if (v) {
      updates.push(
        env.DB.prepare('UPDATE chunks SET embedding = ?, embedding_model = ? WHERE id = ?').bind(toArrayBuffer(encodeVector(v)), model, r.id),
      )
    }
  })
  for (const group of batches(updates, 100)) await env.DB.batch(group)
  return updates.length
}

/** Seed/refresh the public half of the corpus from content/resume.ts (resume + profile). */
export async function seedPublic(env: IngestEnv): Promise<IngestResult> {
  return ingestSources(env, resumeSources(), { replaceKind: 'resume' })
}
