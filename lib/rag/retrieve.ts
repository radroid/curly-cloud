/**
 * Hybrid retrieval: FTS5 BM25 in parallel with exact dense cosine over every embedded chunk,
 * fused with RRF (k=60), optionally reranked by a cross-encoder (with timeout + fallback).
 * The decoded embedding matrix is cached per isolate, keyed by corpus_version and model.
 */
import { all, getCorpusVersion } from '@/lib/db'
import type { AppEnv } from '@/lib/env'
import { embed, embeddingModel, rerank as rerankTexts } from '@/lib/llm'
import { buildFtsQuery } from '@/lib/rag/fts'
import type { RetrievedChunk, SourceKind, Visibility } from '@/lib/rag/types'
import { decodeVector, rrf, topKByCosine, type Fused } from '@/lib/rag/vector'

export type RetrieveEnv = Pick<AppEnv, 'DB' | 'AI' | 'EMBEDDING_MODEL' | 'RERANK_MODEL'>

export const DEFAULT_K = 8
const CANDIDATES = 40
const RERANK_POOL = 20
const RERANK_TIMEOUT_MS = 2500
const RRF_K = 60
/** Multi-query retrieval: each query's top hits that are always kept. */
const TOP_PER_QUERY = 2

// ── Dense index cache ────────────────────────────────────────────────────────

interface DenseIndex {
  version: number
  model: string
  ids: string[]
  dim: number
  matrix: Float32Array
}

const denseCache = new WeakMap<object, DenseIndex>()
let loads = 0

/** For tests: how many times the matrix was (re)loaded from D1. */
export function denseLoadCount(): number {
  return loads
}

export async function loadDenseIndex(env: RetrieveEnv): Promise<DenseIndex> {
  const model = embeddingModel(env)
  const version = await getCorpusVersion(env.DB)
  const cached = denseCache.get(env.DB)
  if (cached && cached.version === version && cached.model === model) return cached
  loads++
  const rows = await all<{ id: string; embedding: unknown }>(
    env.DB,
    'SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL AND embedding_model = ? ORDER BY id',
    model,
  )
  const vectors: Float32Array[] = []
  const ids: string[] = []
  let dim = 0
  for (const r of rows) {
    const v = decodeVector(r.embedding)
    if (!v) continue
    if (!dim) dim = v.length
    if (v.length !== dim) continue
    vectors.push(v)
    ids.push(r.id)
  }
  const matrix = new Float32Array(ids.length * dim)
  vectors.forEach((v, i) => matrix.set(v, i * dim))
  const index: DenseIndex = { version, model, ids, dim, matrix }
  denseCache.set(env.DB, index)
  return index
}

// ── Candidate generation ─────────────────────────────────────────────────────

interface Hit {
  id: string
  score: number
}

export async function ftsSearch(db: D1Database, query: string, limit = CANDIDATES): Promise<Hit[]> {
  const match = buildFtsQuery(query)
  if (!match) return []
  try {
    return await all<Hit>(
      db,
      `SELECT c.id AS id, bm25(chunks_fts) AS score
       FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid
       WHERE chunks_fts MATCH ? ORDER BY score LIMIT ?`,
      match,
      limit,
    )
  } catch (err) {
    console.warn('fts search failed', err)
    return []
  }
}

/** Dense top-N for each query vector. Empty lists when nothing is embedded. */
async function denseSearch(env: RetrieveEnv, queries: string[], limit = CANDIDATES): Promise<Hit[][]> {
  // Load (or reuse) the matrix while the query embedding is in flight.
  const [index, vectors] = await Promise.all([loadDenseIndex(env), embed(env, queries)])
  if (!index.ids.length) return queries.map(() => [])
  return vectors.map((q) => topKByCosine(index.matrix, index.dim, q, limit).map((h) => ({ id: index.ids[h.index], score: h.score })))
}

async function denseSafe(env: RetrieveEnv, queries: string[]): Promise<Hit[][]> {
  try {
    return await denseSearch(env, queries)
  } catch (err) {
    // Workers AI down or slow: fall back to keyword search only.
    console.warn('dense search failed', err)
    return queries.map(() => [])
  }
}

interface ChunkRow {
  id: string
  source_id: string
  text: string
  kind: SourceKind
  visibility: Visibility
  title: string
  topic: string | null
  anchor: string | null
}

async function loadChunkRows(db: D1Database, ids: string[]): Promise<Map<string, ChunkRow>> {
  if (!ids.length) return new Map()
  const rows = await all<ChunkRow>(
    db,
    `SELECT c.id, c.source_id, c.text, s.kind, s.visibility, s.title, s.topic, s.anchor
     FROM chunks c JOIN sources s ON s.id = c.source_id WHERE c.id IN (${ids.map(() => '?').join(', ')})`,
    ...ids,
  )
  return new Map(rows.map((r) => [r.id, r]))
}

function toRetrieved(row: ChunkRow, f: Fused, denseScore: number | null): RetrievedChunk {
  return {
    chunkId: row.id,
    sourceId: row.source_id,
    kind: row.kind,
    visibility: row.visibility,
    title: row.title,
    topic: row.topic ?? null,
    anchor: row.anchor ?? null,
    text: row.text,
    scores: { bm25Rank: f.ranks[0] ?? null, denseRank: f.ranks[1] ?? null, dense: denseScore, rrf: f.score, rerank: null },
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ── Public entry points ──────────────────────────────────────────────────────

export interface RetrieveOptions {
  k?: number
  rerank?: boolean
}

/**
 * The reranker votes as a third ranked list in RRF alongside BM25 and dense, rather than having
 * the final word. bge-reranker-base scores long, dense chunks near zero even when both retrievers
 * rank them highly (e.g. the regdocs eval-harness bullet for "how do you evaluate a RAG system"),
 * so letting it override fusion buried the best evidence.
 */
export function fuseRerank(results: RetrievedChunk[]): RetrievedChunk[] {
  const byRerank = results
    .map((r, i) => ({ i, score: r.scores.rerank }))
    .filter((x): x is { i: number; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
  const rerankRank = new Map(byRerank.map((x, rank) => [x.i, rank + 1]))
  const vote = (rank: number | null | undefined): number => (rank ? 1 / (RRF_K + rank) : 0)
  return results
    .map((r, i) => ({ r, score: vote(r.scores.bm25Rank) + vote(r.scores.denseRank) + vote(rerankRank.get(i)) }))
    .sort((a, b) => b.score - a.score || b.r.scores.rrf - a.r.scores.rrf)
    .map((x) => x.r)
}

export async function retrieveChunks(env: RetrieveEnv, query: string, opts: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const k = Math.max(1, Math.min(50, Math.floor(opts.k ?? DEFAULT_K)))
  const q = query.trim().slice(0, 2000)
  if (!q) return []
  const [bm25, [dense]] = await Promise.all([ftsSearch(env.DB, q), denseSafe(env, [q])])
  const fused = rrf([bm25.map((h) => h.id), dense.map((h) => h.id)], RRF_K)
  const pool = fused.slice(0, Math.max(k, RERANK_POOL))
  const rows = await loadChunkRows(env.DB, pool.map((f) => f.id))
  const denseScore = new Map(dense.map((h) => [h.id, h.score]))
  let results = pool.flatMap((f) => {
    const row = rows.get(f.id)
    return row ? [toRetrieved(row, f, denseScore.get(f.id) ?? null)] : []
  })
  if (opts.rerank !== false && results.length > 1) {
    try {
      const ranked = await withTimeout(
        rerankTexts(env, q, results.map((r) => r.text.slice(0, 1500)), results.length),
        RERANK_TIMEOUT_MS,
      )
      const scores = new Map(ranked.map((r) => [r.index, r.score]))
      results = results.map((r, i) => ({ ...r, scores: { ...r.scores, rerank: scores.get(i) ?? null } }))
      results = fuseRerank(results)
    } catch (err) {
      console.warn('rerank failed; using RRF order', err)
    }
  }
  return results.slice(0, k)
}

/**
 * Several queries at once (fit assessment): one batched embedding call, BM25 per query, RRF per
 * query, then RRF across queries. No rerank.
 */
export async function retrieveForQueries(env: RetrieveEnv, queries: string[], limit: number): Promise<RetrievedChunk[]> {
  const qs = queries.map((q) => q.trim().slice(0, 1000)).filter(Boolean)
  if (!qs.length) return []
  const [bm25Lists, denseLists] = await Promise.all([Promise.all(qs.map((q) => ftsSearch(env.DB, q, 20))), denseSafe(env, qs)])
  const perQuery = qs.map((_, i) => rrf([bm25Lists[i].map((h) => h.id), denseLists[i].slice(0, 20).map((h) => h.id)], RRF_K))
  const global = rrf(perQuery.map((list) => list.map((f) => f.id)), RRF_K)
  // Chunks that match many queries dominate a plain cross-query RRF, so each query's own top hits
  // are guaranteed a slot first (round-robin), then the rest fill in fused order.
  const guaranteed: string[] = []
  for (let rank = 0; rank < TOP_PER_QUERY; rank++) for (const list of perQuery) if (list[rank]) guaranteed.push(list[rank].id)
  const byId = new Map(global.map((f) => [f.id, f]))
  const order = [...new Set([...guaranteed, ...global.map((f) => f.id)])].slice(0, limit)
  const rows = await loadChunkRows(env.DB, order)
  return order.flatMap((id) => {
    const row = rows.get(id)
    const f = byId.get(id)
    return row && f ? [toRetrieved(row, { ...f, ranks: [null, null] }, null)] : []
  })
}

/** Retrieval query for a conversation: the last user turn, plus the previous one for follow-ups. */
export function retrievalQuery(messages: { role: string; content: string }[]): string {
  const users = messages.filter((m) => m.role === 'user').map((m) => m.content.trim())
  const last = users[users.length - 1] ?? ''
  const prev = users[users.length - 2]
  return prev ? `${last}\n${prev.slice(0, 300)}` : last
}
