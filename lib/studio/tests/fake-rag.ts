/**
 * In-memory stand-in for lib/rag, used by the studio's route tests via vi.mock('@/lib/rag').
 * Sources go into the test D1 `sources` table (one chunk each) so the studio's own SQL sees them.
 */
import { all, first, run } from '@/lib/db'
import type { AppEnv } from '@/lib/env'
import type { IngestResult, SourceInput, SourceKind, SourceRecord, TopicSummary } from '@/lib/rag/types'

export const controls = {
  /** Make every function throw like the foundation stubs do. */
  stubbed: false,
  /** Make only corpusStats throw. */
  corpusFails: false,
  calls: { ingest: 0 },
}

export function resetControls(): void {
  controls.stubbed = false
  controls.corpusFails = false
  controls.calls.ingest = 0
}

function guard(name: string): void {
  if (controls.stubbed) throw new Error(`lib/rag.${name} is not implemented yet`)
}

interface Row {
  id: string
  kind: SourceKind
  visibility: 'public' | 'private'
  title: string
  topic: string | null
  anchor: string | null
  body: string
  meta: string | null
  content_hash: string
  created_at: number
  updated_at: number
  chunk_count: number
}

const toRecord = (r: Row): SourceRecord => ({
  id: r.id,
  kind: r.kind,
  visibility: r.visibility,
  title: r.title,
  topic: r.topic,
  anchor: r.anchor,
  body: r.body,
  meta: r.meta ? JSON.parse(r.meta) : {},
  contentHash: r.content_hash,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  chunkCount: Number(r.chunk_count),
})

const SELECT = 'SELECT s.*, (SELECT COUNT(*) FROM chunks c WHERE c.source_id = s.id) AS chunk_count FROM sources s'

export async function ingestSources(env: AppEnv, inputs: SourceInput[], opts: { replaceKind?: SourceKind } = {}): Promise<IngestResult> {
  guard('ingestSources')
  void opts
  controls.calls.ingest++
  const at = Date.now()
  for (const s of inputs) {
    const hash = `${s.title}|${s.body}|${s.topic ?? ''}|${s.visibility}`
    await run(
      env.DB,
      `INSERT INTO sources (id, kind, visibility, title, topic, anchor, body, meta, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, visibility = excluded.visibility, title = excluded.title,
         topic = excluded.topic, anchor = excluded.anchor, body = excluded.body, meta = excluded.meta,
         content_hash = excluded.content_hash, updated_at = excluded.updated_at`,
      s.id, s.kind, s.visibility, s.title, s.topic ?? null, s.anchor ?? null, s.body, JSON.stringify(s.meta ?? {}), hash, at, at,
    )
    await run(env.DB, 'DELETE FROM chunks WHERE source_id = ?', s.id)
    await run(env.DB, 'INSERT INTO chunks (id, source_id, ord, text) VALUES (?, ?, 0, ?)', `${s.id}#0`, s.id, `${s.title}\n${s.body}`)
  }
  return { upserted: inputs.length, unchanged: 0, deleted: 0, chunks: inputs.length, embedded: 0, errors: [], corpusVersion: 1 }
}

export async function getSource(env: AppEnv, id: string): Promise<SourceRecord | null> {
  guard('getSource')
  const row = await first<Row>(env.DB, `${SELECT} WHERE s.id = ?`, id)
  return row ? toRecord(row) : null
}

export async function listSources(
  env: AppEnv,
  filter: { kind?: SourceKind; topic?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: SourceRecord[]; total: number }> {
  guard('listSources')
  const where: string[] = []
  const params: unknown[] = []
  if (filter.kind) (where.push('s.kind = ?'), params.push(filter.kind))
  if (filter.topic) (where.push('s.topic = ?'), params.push(filter.topic))
  if (filter.q) (where.push('(s.title LIKE ? OR s.body LIKE ?)'), params.push(`%${filter.q}%`, `%${filter.q}%`))
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const rows = await all<Row>(env.DB, `${SELECT}${clause} ORDER BY s.updated_at DESC LIMIT ? OFFSET ?`, ...params, filter.limit ?? 50, filter.offset ?? 0)
  const total = await first<{ n: number }>(env.DB, `SELECT COUNT(*) AS n FROM sources s${clause}`, ...params)
  return { items: rows.map(toRecord), total: Number(total?.n ?? 0) }
}

export async function deleteSources(env: AppEnv, ids: string[]): Promise<number> {
  guard('deleteSources')
  let n = 0
  for (const id of ids) n += (await run(env.DB, 'DELETE FROM sources WHERE id = ?', id)).meta?.changes ?? 0
  return n
}

export async function corpusStats(env: AppEnv): Promise<{
  sources: Record<SourceKind, number>
  chunks: number
  embedded: number
  corpusVersion: number
  topics: TopicSummary[]
  persona: { updatedAt: number | null; chars: number }
}> {
  guard('corpusStats')
  if (controls.corpusFails) throw new Error('corpusStats exploded')
  const rows = await all<{ kind: SourceKind; n: number }>(env.DB, 'SELECT kind, COUNT(*) AS n FROM sources GROUP BY kind')
  const sources = { resume: 0, profile: 0, interview: 0, note: 0, correction: 0 }
  for (const r of rows) sources[r.kind] = Number(r.n)
  const chunks = await first<{ n: number }>(env.DB, 'SELECT COUNT(*) AS n FROM chunks')
  return { sources, chunks: Number(chunks?.n ?? 0), embedded: 0, corpusVersion: 1, topics: [], persona: { updatedAt: null, chars: 0 } }
}

const notUsed = (name: string) => async (): Promise<never> => {
  throw new Error(`fake lib/rag.${name} is not used by the studio`)
}
export const answerStream = notUsed('answerStream')
export const answer = notUsed('answer')
export const assessFit = notUsed('assessFit')
export const seedPublicSources = notUsed('seedPublicSources')
export const retrieve = notUsed('retrieve')
export const listTopics = notUsed('listTopics')
export const getPersona = notUsed('getPersona')
export const rebuildPersona = notUsed('rebuildPersona')
