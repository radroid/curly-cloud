/** Topic coverage and corpus stats. Counts only; never any source text. */
import { TOPICS, topicLabel } from '@/content/topics'
import { all, first, getCorpusVersion, getMeta } from '@/lib/db'
import type { AppEnv } from '@/lib/env'
import { embeddingModel } from '@/lib/llm'
import type { SourceKind, TopicSummary } from '@/lib/rag/types'

const TOPIC_ORDER = new Map(TOPICS.map((t, i) => [t.id, i]))

export async function topicSummaries(db: D1Database): Promise<TopicSummary[]> {
  const rows = await all<{ topic: string | null; n: number }>(db, 'SELECT topic, COUNT(*) AS n FROM sources GROUP BY topic')
  const counts = new Map<string, number>()
  for (const r of rows) {
    const id = r.topic || 'general'
    counts.set(id, (counts.get(id) ?? 0) + Number(r.n))
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, label: topic === 'general' ? 'General' : topicLabel(topic), count }))
    .sort((a, b) => (TOPIC_ORDER.get(a.topic) ?? 999) - (TOPIC_ORDER.get(b.topic) ?? 999) || a.topic.localeCompare(b.topic))
}

export async function stats(env: Pick<AppEnv, 'DB' | 'EMBEDDING_MODEL'>): Promise<{
  sources: Record<SourceKind, number>
  chunks: number
  embedded: number
  corpusVersion: number
  topics: TopicSummary[]
  persona: { updatedAt: number | null; chars: number }
}> {
  const db = env.DB
  const [kinds, chunkRow, corpusVersion, topics, persona, personaAt] = await Promise.all([
    all<{ kind: SourceKind; n: number }>(db, 'SELECT kind, COUNT(*) AS n FROM sources GROUP BY kind'),
    first<{ chunks: number; embedded: number }>(
      db,
      'SELECT COUNT(*) AS chunks, SUM(CASE WHEN embedding IS NOT NULL AND embedding_model = ? THEN 1 ELSE 0 END) AS embedded FROM chunks',
      embeddingModel(env),
    ),
    getCorpusVersion(db),
    topicSummaries(db),
    getMeta(db, 'persona'),
    getMeta(db, 'persona_updated_at'),
  ])
  const sources: Record<SourceKind, number> = { resume: 0, profile: 0, interview: 0, note: 0, correction: 0 }
  for (const k of kinds) sources[k.kind] = Number(k.n)
  return {
    sources,
    chunks: Number(chunkRow?.chunks ?? 0),
    embedded: Number(chunkRow?.embedded ?? 0),
    corpusVersion,
    topics,
    persona: { updatedAt: personaAt ? Number(personaAt) : null, chars: persona?.length ?? 0 },
  }
}
