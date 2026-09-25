/** Source rows: mapping, get/list/delete. */
import { all, bumpCorpusVersion, first, parseJson, run } from '@/lib/db'
import type { SourceKind, SourceRecord, Visibility } from '@/lib/rag/types'

export interface SourceRow {
  id: string
  kind: SourceKind
  visibility: Visibility
  title: string
  topic: string | null
  anchor: string | null
  body: string
  meta: string | null
  content_hash: string
  created_at: number
  updated_at: number
  chunk_count?: number
}

export function toSourceRecord(r: SourceRow): SourceRecord {
  return {
    id: r.id,
    kind: r.kind,
    visibility: r.visibility,
    title: r.title,
    topic: r.topic ?? null,
    anchor: r.anchor ?? null,
    body: r.body,
    meta: parseJson<Record<string, unknown>>(r.meta, {}),
    contentHash: r.content_hash,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    chunkCount: Number(r.chunk_count ?? 0),
  }
}

const WITH_COUNT = 'SELECT s.*, (SELECT COUNT(*) FROM chunks c WHERE c.source_id = s.id) AS chunk_count FROM sources s'

export async function getSourceRecord(db: D1Database, id: string): Promise<SourceRecord | null> {
  const row = await first<SourceRow>(db, `${WITH_COUNT} WHERE s.id = ?`, id)
  return row ? toSourceRecord(row) : null
}

export interface SourceFilter {
  kind?: SourceKind
  topic?: string
  q?: string
  limit?: number
  offset?: number
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function listSourceRecords(db: D1Database, filter: SourceFilter = {}): Promise<{ items: SourceRecord[]; total: number }> {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.kind) {
    where.push('s.kind = ?')
    params.push(filter.kind)
  }
  if (filter.topic) {
    where.push('s.topic = ?')
    params.push(filter.topic)
  }
  const q = filter.q?.trim()
  if (q) {
    const like = `%${escapeLike(q.slice(0, 200))}%`
    where.push("(s.title LIKE ? ESCAPE '\\' OR s.body LIKE ? ESCAPE '\\')")
    params.push(like, like)
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(200, Math.max(1, Math.floor(filter.limit ?? 50)))
  const offset = Math.max(0, Math.floor(filter.offset ?? 0))
  const [rows, count] = await Promise.all([
    all<SourceRow>(db, `${WITH_COUNT}${clause} ORDER BY s.updated_at DESC, s.id LIMIT ? OFFSET ?`, ...params, limit, offset),
    first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM sources s${clause}`, ...params),
  ])
  return { items: rows.map(toSourceRecord), total: Number(count?.n ?? 0) }
}

/** D1 caps bound parameters per statement at 100; stay well under. */
export const ID_BATCH = 50

export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Delete sources and their chunks without bumping the corpus version. Returns sources deleted. */
export async function deleteSourceRows(db: D1Database, ids: string[]): Promise<number> {
  let deleted = 0
  for (const group of batches([...new Set(ids)], ID_BATCH)) {
    const marks = group.map(() => '?').join(', ')
    await run(db, `DELETE FROM chunks WHERE source_id IN (${marks})`, ...group)
    const res = await run(db, `DELETE FROM sources WHERE id IN (${marks})`, ...group)
    deleted += Number(res.meta?.changes ?? 0)
  }
  return deleted
}

export async function deleteSourcesAndBump(db: D1Database, ids: string[]): Promise<number> {
  const deleted = await deleteSourceRows(db, ids)
  if (deleted > 0) await bumpCorpusVersion(db)
  return deleted
}
