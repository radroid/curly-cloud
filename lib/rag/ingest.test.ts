import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { getCorpusVersion } from '@/lib/db'
import { corpusStats, deleteSources, getSource, ingestSources, listSources, listTopics, retrieve, seedPublicSources } from '@/lib/rag'
import { IngestLimitError } from '@/lib/rag/ingest'
import { denseLoadCount } from '@/lib/rag/retrieve'
import { createTestEnv, FAKE_PRIVATE, withVars } from '@/lib/rag/testing'
import type { SourceInput } from '@/lib/rag/types'

const count = async (env: ReturnType<typeof createTestEnv>, sql: string): Promise<number> =>
  Number(((await env.DB.prepare(sql).first()) as { n: number }).n)

describe('ingestSources', () => {
  it('is idempotent: unchanged hashes are skipped', async () => {
    const env = createTestEnv()
    const first = await ingestSources(env, FAKE_PRIVATE)
    expect(first).toMatchObject({ upserted: 2, unchanged: 0, deleted: 0, chunks: 2, embedded: 2, errors: [], corpusVersion: 1 })
    const embedCalls = env.AI.count('embed')
    const again = await ingestSources(env, FAKE_PRIVATE)
    expect(again).toMatchObject({ upserted: 0, unchanged: 2, chunks: 0, embedded: 0, corpusVersion: 2 })
    expect(env.AI.count('embed')).toBe(embedCalls)
    expect(await count(env, 'SELECT COUNT(*) AS n FROM chunks')).toBe(2)
  })

  it('replaces chunks for changed sources and keeps created_at', async () => {
    const env = createTestEnv()
    await ingestSources(env, FAKE_PRIVATE)
    const before = await getSource(env, FAKE_PRIVATE[0].id)
    const longBody = Array.from({ length: 30 }, (_, i) => `Point ${i} about careful debugging and writing things down.`).join(' ')
    const res = await ingestSources(env, [{ ...FAKE_PRIVATE[0], body: longBody }])
    expect(res.upserted).toBe(1)
    const after = await getSource(env, FAKE_PRIVATE[0].id)
    expect(after?.body).toBe(longBody)
    expect(after?.chunkCount).toBeGreaterThan(1)
    expect(after?.createdAt).toBe(before?.createdAt)
    // FTS stays in sync with the replaced chunks.
    expect(await count(env, "SELECT COUNT(*) AS n FROM chunks_fts WHERE chunks_fts MATCH '\"bisect\"'")).toBe(0)
    expect(await count(env, "SELECT COUNT(*) AS n FROM chunks_fts WHERE chunks_fts MATCH '\"careful\"'")).toBe(after?.chunkCount)
  })

  it('replaceKind deletes sources of that kind that were not provided', async () => {
    const env = createTestEnv()
    const seeded = await seedPublicSources(env)
    const n = resumeSources().length
    expect(seeded.upserted).toBe(n)
    const trimmed = resumeSources().filter((s) => s.id !== 'resume:exp:eddy:tracker')
    const res = await ingestSources(env, trimmed, { replaceKind: 'resume' })
    expect(res.deleted).toBe(1)
    expect(res.unchanged).toBe(n - 1)
    expect(await getSource(env, 'resume:exp:eddy:tracker')).toBeNull()
    expect(await count(env, "SELECT COUNT(*) AS n FROM chunks WHERE source_id = 'resume:exp:eddy:tracker'")).toBe(0)
    // Other kinds are untouched.
    await ingestSources(env, FAKE_PRIVATE)
    await ingestSources(env, trimmed, { replaceKind: 'resume' })
    expect(await getSource(env, FAKE_PRIVATE[0].id)).not.toBeNull()
  })

  it('bumps corpus_version on every ingest and delete', async () => {
    const env = createTestEnv()
    expect(await getCorpusVersion(env.DB)).toBe(0)
    await ingestSources(env, FAKE_PRIVATE)
    await ingestSources(env, [])
    expect(await getCorpusVersion(env.DB)).toBe(2)
    expect(await deleteSources(env, [FAKE_PRIVATE[0].id, 'missing'])).toBe(1)
    expect(await getCorpusVersion(env.DB)).toBe(3)
    expect(await deleteSources(env, ['missing'])).toBe(0)
    expect(await getCorpusVersion(env.DB)).toBe(3)
  })

  it('re-embeds everything when the embedding model changes', async () => {
    const env = createTestEnv()
    await ingestSources(env, FAKE_PRIVATE)
    const env2 = withVars(env, { EMBEDDING_MODEL: '@cf/baai/bge-large-en-v1.5' })
    const res = await ingestSources(env2, [])
    expect(res.embedded).toBe(2)
    expect(await count(env, "SELECT COUNT(*) AS n FROM chunks WHERE embedding_model = '@cf/baai/bge-large-en-v1.5'")).toBe(2)
    expect((await ingestSources(env2, [])).embedded).toBe(0)
  })

  it('stores chunks for keyword search when embeddings fail, and repairs them later', async () => {
    const down = createTestEnv({ failEmbeddings: true })
    const res = await ingestSources(down, FAKE_PRIVATE)
    expect(res.upserted).toBe(2)
    expect(res.embedded).toBe(0)
    expect(res.errors.map((e) => e.id)).toEqual(FAKE_PRIVATE.map((s) => s.id))
    const hits = await retrieve(down, 'favourite debugging approach')
    expect(hits[0]?.sourceId).toBe('interview:engineering-001')
    const up = createTestEnv()
    const healed = await ingestSources({ ...up, DB: down.DB } as typeof up, [])
    expect(healed.embedded).toBe(2)
  })

  it('reports per-source errors without failing the batch', async () => {
    const env = createTestEnv()
    const bad = [
      { ...FAKE_PRIVATE[0] },
      { ...FAKE_PRIVATE[0], title: 'dup' },
      { id: 'has space', kind: 'note', visibility: 'private', title: 't', body: 'b' },
      { id: 'note:x', kind: 'bogus', visibility: 'private', title: 't', body: 'b' },
      { id: 'note:y', kind: 'note', visibility: 'private', title: 't', body: '   ' },
    ] as SourceInput[]
    const res = await ingestSources(env, bad)
    expect(res.upserted).toBe(1)
    expect(res.errors).toHaveLength(4)
    expect(res.errors[0]).toMatchObject({ id: FAKE_PRIVATE[0].id, message: expect.stringMatching(/Duplicate/) })
  })

  it('caps a call at 500 sources', async () => {
    const env = createTestEnv()
    const many = Array.from({ length: 501 }, (_, i) => ({ ...FAKE_PRIVATE[0], id: `note:${i}` }))
    await expect(ingestSources(env, many)).rejects.toBeInstanceOf(IngestLimitError)
  })
})

describe('source listing and stats', () => {
  it('lists with kind/topic/q filters and paging, and counts topics without text', async () => {
    const env = createTestEnv()
    await seedPublicSources(env)
    await ingestSources(env, FAKE_PRIVATE)
    const all = await listSources(env, { limit: 5 })
    expect(all.items).toHaveLength(5)
    expect(all.total).toBe(resumeSources().length + 2)
    const interviews = await listSources(env, { kind: 'interview' })
    expect(interviews.items.map((s) => s.id).sort()).toEqual(FAKE_PRIVATE.map((s) => s.id).sort())
    expect(interviews.items[0].chunkCount).toBe(1)
    expect((await listSources(env, { topic: 'work-style' })).total).toBe(1)
    expect((await listSources(env, { q: 'bisect' })).items.map((s) => s.id)).toEqual(['interview:engineering-001'])
    expect((await listSources(env, { q: '100%_' })).total).toBe(0)
    expect((await listSources(env, { limit: 5, offset: 5 })).items[0].id).not.toBe(all.items[0].id)

    const topics = await listTopics(env)
    expect(topics.find((t) => t.topic === 'experience')).toMatchObject({ label: 'Experience' })
    expect(topics.find((t) => t.topic === 'engineering')).toEqual({ topic: 'engineering', label: 'Engineering taste', count: 1 })
    expect(JSON.stringify(topics)).not.toMatch(/bisect/)

    const stats = await corpusStats(env)
    expect(stats.sources).toMatchObject({ interview: 2, profile: 1, note: 0 })
    expect(stats.chunks).toBe(stats.embedded)
    expect(stats.persona).toEqual({ updatedAt: null, chars: 0 })
  })
})

describe('retrieval end to end (fake embeddings)', () => {
  it('finds the right resume bullets with hybrid search', async () => {
    const env = createTestEnv()
    await seedPublicSources(env)
    const hits = await retrieve(env, 'What did you build at Eddy?', { k: 8 })
    expect(hits).toHaveLength(8)
    expect(hits.slice(0, 3).some((h) => h.sourceId.startsWith('resume:exp:eddy'))).toBe(true)
    expect(hits[0].scores.rrf).toBeGreaterThan(0)
    expect(hits[0].scores.rerank).not.toBeNull()
    const edu = await retrieve(env, 'nuclear engineering degree Manchester', { k: 3 })
    expect(edu[0].sourceId).toBe('resume:education')
  })

  it('survives hostile queries and an empty corpus', async () => {
    const env = createTestEnv()
    expect(await retrieve(env, 'anything')).toEqual([])
    await seedPublicSources(env)
    const hits = await retrieve(env, '"foo" OR bar* NEAR( ))) ^ col:')
    expect(Array.isArray(hits)).toBe(true)
  })

  it('caches the dense matrix per corpus_version', async () => {
    const env = createTestEnv()
    await seedPublicSources(env)
    const before = denseLoadCount()
    await retrieve(env, 'kafka')
    await retrieve(env, 'docker')
    expect(denseLoadCount()).toBe(before + 1)
    await ingestSources(env, FAKE_PRIVATE)
    await retrieve(env, 'debugging')
    expect(denseLoadCount()).toBe(before + 2)
  })

  it('falls back to RRF order when rerank fails or times out, and to BM25 when embeddings fail', async () => {
    const env = createTestEnv({ failRerank: true })
    await seedPublicSources(env)
    const hits = await retrieve(env, 'Kafka event-driven data flow', { k: 3 })
    expect(hits[0].sourceId).toBe('resume:exp:pinhous:kafka')
    expect(hits[0].scores.rerank).toBeNull()

    const slow = createTestEnv({ rerankDelayMs: 3000 })
    await seedPublicSources(slow)
    const started = Date.now()
    const slowHits = await retrieve(slow, 'Kafka event-driven data flow', { k: 3 })
    expect(Date.now() - started).toBeLessThan(2900)
    expect(slowHits[0].scores.rerank).toBeNull()

    const noEmbed = createTestEnv({ failEmbeddings: true })
    await ingestSources(noEmbed, resumeSources())
    const bm25Only = await retrieve(noEmbed, 'Kafka event-driven', { k: 3, rerank: false })
    expect(bm25Only[0].sourceId).toBe('resume:exp:pinhous:kafka')
    expect(bm25Only[0].scores.denseRank).toBeNull()
  }, 10_000)
})
