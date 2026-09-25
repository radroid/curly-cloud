/**
 * Conversation logs for the studio: direct SQL on chat_logs (written by lib/rag), plus
 * resolution of the sources each answer used. The citations/retrieved JSON columns are owned
 * by lib/rag, so parsing here is deliberately tolerant of a few plausible shapes.
 */
import { all, first, parseJson, run } from '@/lib/db'
import type { Channel, SourceKind, Visibility } from '@/lib/rag/types'
import { citedNumbers } from '@/lib/studio/shared'
import type { LogDetail, LogItem, LogSourceRef, Page } from '@/lib/studio/types'

interface LogRow {
  id: string
  channel: Channel
  kind: 'ask' | 'fit'
  client_id: string
  key_id: string | null
  key_label: string | null
  question: string
  answer: string
  citations: string
  retrieved: string
  provider: string | null
  model: string | null
  tokens_in: number
  tokens_out: number
  latency_ms: number
  guarded: number
  flagged: number
  correction_source_id: string | null
  created_at: number
}

function toItem(r: LogRow): LogItem {
  const citations = parseJson<unknown>(r.citations, [])
  const retrieved = parseJson<unknown>(r.retrieved, [])
  return {
    id: r.id,
    channel: r.channel,
    kind: r.kind,
    clientId: r.client_id,
    keyId: r.key_id,
    keyLabel: r.key_label ?? null,
    question: r.question,
    answer: r.answer,
    citations: Array.isArray(citations) ? citations : [],
    retrieved: Array.isArray(retrieved) ? retrieved : [],
    provider: r.provider,
    model: r.model,
    tokensIn: Number(r.tokens_in),
    tokensOut: Number(r.tokens_out),
    latencyMs: Number(r.latency_ms),
    guarded: Number(r.guarded) === 1,
    flagged: Number(r.flagged) === 1,
    correctionSourceId: r.correction_source_id,
    createdAt: Number(r.created_at),
  }
}

export interface LogFilter {
  channel?: Channel
  flagged?: boolean
  q?: string
  keyId?: string
  limit: number
  offset: number
}

const SELECT = 'SELECT l.*, k.label AS key_label FROM chat_logs l LEFT JOIN api_keys k ON k.id = l.key_id'

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function listLogs(db: D1Database, filter: LogFilter): Promise<Page<LogItem>> {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.channel) {
    where.push('l.channel = ?')
    params.push(filter.channel)
  }
  if (filter.flagged !== undefined) {
    where.push('l.flagged = ?')
    params.push(filter.flagged ? 1 : 0)
  }
  if (filter.keyId) {
    where.push('l.key_id = ?')
    params.push(filter.keyId)
  }
  if (filter.q) {
    const like = `%${escapeLike(filter.q)}%`
    where.push("(l.question LIKE ? ESCAPE '\\' OR l.answer LIKE ? ESCAPE '\\')")
    params.push(like, like)
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : ''
  const [rows, count] = await Promise.all([
    all<LogRow>(db, `${SELECT}${clause} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`, ...params, filter.limit, filter.offset),
    first<{ n: number }>(db, `SELECT COUNT(*) AS n FROM chat_logs l${clause}`, ...params),
  ])
  return { items: rows.map(toItem), total: Number(count?.n ?? 0) }
}

export async function getLog(db: D1Database, id: string): Promise<LogItem | null> {
  const row = await first<LogRow>(db, `${SELECT} WHERE l.id = ?`, id)
  return row ? toItem(row) : null
}

export async function setLogFlagged(db: D1Database, id: string, flagged: boolean): Promise<boolean> {
  const res = await run(db, 'UPDATE chat_logs SET flagged = ? WHERE id = ?', flagged ? 1 : 0, id)
  return (res.meta?.changes ?? 0) > 0
}

export async function linkCorrection(db: D1Database, id: string, sourceId: string): Promise<void> {
  await run(db, 'UPDATE chat_logs SET correction_source_id = ?, flagged = 0 WHERE id = ?', sourceId, id)
}

/** When a correction source is deleted, the log goes back to "uncorrected". */
export async function unlinkCorrection(db: D1Database, sourceId: string): Promise<void> {
  await run(db, 'UPDATE chat_logs SET correction_source_id = NULL WHERE correction_source_id = ?', sourceId)
}

// ── Resolving cited and retrieved sources ────────────────────────────────────

interface RawRef {
  n: number | null
  sourceId: string | null
  chunkId: string | null
  title: string | null
  score: number | null
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function readRef(entry: unknown, index: number, numbered: boolean): RawRef | null {
  if (typeof entry === 'number') return { n: entry, sourceId: null, chunkId: null, title: null, score: null }
  if (typeof entry === 'string') return { n: numbered ? index + 1 : null, sourceId: entry, chunkId: null, title: null, score: null }
  if (!entry || typeof entry !== 'object') return null
  const o = entry as Record<string, unknown>
  const scores = (o.scores && typeof o.scores === 'object' ? o.scores : {}) as Record<string, unknown>
  return {
    n: num(o.n) ?? (numbered ? index + 1 : null),
    sourceId: str(o.sourceId) ?? str(o.source_id) ?? str(o.id),
    chunkId: str(o.chunkId) ?? str(o.chunk_id),
    title: str(o.title) ?? str(o.label),
    score: num(o.rerank) ?? num(scores.rerank) ?? num(o.rrf) ?? num(scores.rrf) ?? num(o.score),
  }
}

interface SourceMeta {
  id: string
  title: string
  kind: SourceKind
  visibility: Visibility
  topic: string | null
}

async function lookupSources(db: D1Database, refs: RawRef[]): Promise<Map<string, SourceMeta>> {
  const byId = new Map<string, SourceMeta>()
  const ids = [...new Set(refs.flatMap((r) => [r.sourceId, r.chunkId]).filter((v): v is string => !!v))].slice(0, 100)
  if (!ids.length) return byId
  const marks = ids.map(() => '?').join(', ')
  for (const s of await all<SourceMeta>(db, `SELECT id, title, kind, visibility, topic FROM sources WHERE id IN (${marks})`, ...ids)) {
    byId.set(s.id, s)
  }
  // Some ids may be chunk ids: map them to their source.
  const unresolved = ids.filter((id) => !byId.has(id))
  if (unresolved.length) {
    const rows = await all<SourceMeta & { chunk_id: string }>(
      db,
      `SELECT c.id AS chunk_id, s.id, s.title, s.kind, s.visibility, s.topic FROM chunks c JOIN sources s ON s.id = c.source_id WHERE c.id IN (${unresolved.map(() => '?').join(', ')})`,
      ...unresolved,
    )
    for (const r of rows) byId.set(r.chunk_id, { id: r.id, title: r.title, kind: r.kind, visibility: r.visibility, topic: r.topic })
  }
  return byId
}

function resolve(ref: RawRef, found: Map<string, SourceMeta>, cited: Set<number>): LogSourceRef {
  const meta = (ref.sourceId && found.get(ref.sourceId)) || (ref.chunkId && found.get(ref.chunkId)) || null
  return {
    n: ref.n,
    sourceId: meta?.id ?? ref.sourceId,
    chunkId: ref.chunkId,
    title: meta?.title ?? ref.title ?? (ref.sourceId ?? (ref.n != null ? `Source ${ref.n}` : 'Unknown source')),
    kind: meta?.kind ?? null,
    visibility: meta?.visibility ?? null,
    topic: meta?.topic ?? null,
    exists: !!meta,
    score: ref.score,
    cited: ref.n != null && cited.has(ref.n),
  }
}

export async function getLogDetail(db: D1Database, id: string): Promise<LogDetail | null> {
  const item = await getLog(db, id)
  if (!item) return null
  const numberedRaw = item.citations.map((c, i) => readRef(c, i, true)).filter((r): r is RawRef => !!r)
  const retrievedRaw = item.retrieved.map((c, i) => readRef(c, i, false)).filter((r): r is RawRef => !!r)
  const found = await lookupSources(db, [...numberedRaw, ...retrievedRaw])
  const cited = citedNumbers(item.answer)

  const numbered = numberedRaw.map((r) => resolve(r, found, cited)).sort((a, b) => (a.n ?? 0) - (b.n ?? 0))
  const seen = new Set<string>()
  const retrievedSources: LogSourceRef[] = []
  for (const r of retrievedRaw.map((r) => resolve(r, found, cited))) {
    const key = r.sourceId ?? r.chunkId ?? r.title
    if (seen.has(key)) continue
    seen.add(key)
    retrievedSources.push(r)
  }
  return { ...item, numbered, retrievedSources }
}
