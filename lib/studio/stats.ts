/**
 * Everything the dashboard shows, gathered in one pass. Used by GET /api/admin/stats and by the
 * dashboard server component directly. lib/rag's `corpusStats` is optional: when it throws
 * (stubs before the RAG merge, or a runtime failure) the rest still renders.
 */
import { TOPICS } from '@/content/topics'
import { all, dayKey, first } from '@/lib/db'
import { getLimits, type AppEnv } from '@/lib/env'
import { corpusStats } from '@/lib/rag'
import type { Channel, SourceKind } from '@/lib/rag/types'
import { dayWindowStart } from '@/lib/studio/keys'
import { messageOf } from '@/lib/studio/http'
import { CHANNELS, SOURCE_KINDS } from '@/lib/studio/shared'
import type { CorpusStats, StudioStats, TopicCoverage, UsageDay } from '@/lib/studio/types'

const DAY_MS = 86_400_000
const USAGE_DAYS = 14
/** How many of the thinnest interview topics to call out. */
const THIN_COUNT = 4
/** Catch-all topics that shouldn't be nagged about. */
const NEVER_THIN = new Set(['notes', 'lightning'])

async function safeCorpus(env: AppEnv): Promise<{ corpus: CorpusStats | null; corpusError?: string }> {
  try {
    return { corpus: await corpusStats(env) }
  } catch (err) {
    return { corpus: null, corpusError: messageOf(err) }
  }
}

async function coverage(db: D1Database): Promise<{ coverage: TopicCoverage[]; byKind: Record<SourceKind, number> }> {
  const rows = await all<{ topic: string | null; kind: SourceKind; n: number; words: number }>(
    db,
    `SELECT topic, kind, COUNT(*) AS n,
            SUM(LENGTH(TRIM(body)) - LENGTH(REPLACE(TRIM(body), ' ', '')) + 1) AS words
     FROM sources GROUP BY topic, kind`,
  )
  const byKind = Object.fromEntries(SOURCE_KINDS.map((k) => [k, 0])) as Record<SourceKind, number>
  const byTopic = new Map<string, { sources: number; words: number }>()
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] ?? 0) + Number(r.n)
    if (r.kind === 'resume' || r.kind === 'profile') continue
    const key = r.topic ?? 'notes'
    const t = byTopic.get(key) ?? { sources: 0, words: 0 }
    t.sources += Number(r.n)
    t.words += Number(r.words ?? 0)
    byTopic.set(key, t)
  }
  const known = new Set(TOPICS.map((t) => t.id))
  const list: TopicCoverage[] = TOPICS.map((t) => ({
    topic: t.id,
    label: t.label,
    origin: t.origin,
    sources: byTopic.get(t.id)?.sources ?? 0,
    words: byTopic.get(t.id)?.words ?? 0,
    thin: false,
  }))
  // Topics written in D1 that content/topics.ts doesn't know about still count.
  for (const [topic, t] of byTopic) {
    if (!known.has(topic)) list.push({ topic, label: topic, origin: 'interview', sources: t.sources, words: t.words, thin: false })
  }
  const thinnest = list
    .filter((t) => t.origin === 'interview' && !NEVER_THIN.has(t.topic) && known.has(t.topic))
    .sort((a, b) => a.sources - b.sources || a.words - b.words)
    .slice(0, THIN_COUNT)
  for (const t of thinnest) t.thin = true
  return { coverage: list, byKind }
}

async function usage(db: D1Database, at: number): Promise<UsageDay[]> {
  const days = Array.from({ length: USAGE_DAYS }, (_, i) => dayKey(at - (USAGE_DAYS - 1 - i) * DAY_MS))
  const rows = await all<{ day: string; requests: number; tokens_in: number; tokens_out: number }>(
    db,
    'SELECT day, requests, tokens_in, tokens_out FROM usage_daily WHERE day >= ? ORDER BY day',
    days[0],
  )
  const byDay = new Map(rows.map((r) => [r.day, r]))
  return days.map((day) => {
    const r = byDay.get(day)
    return { day, requests: Number(r?.requests ?? 0), tokensIn: Number(r?.tokens_in ?? 0), tokensOut: Number(r?.tokens_out ?? 0) }
  })
}

export async function getStudioStats(env: AppEnv, at: number = Date.now()): Promise<StudioStats> {
  const db = env.DB
  const today = dayWindowStart(at)
  const weekStart = today - 6 * DAY_MS

  const [corpus, cov, usageDays, channelRows, flagged, guarded, keys, recent] = await Promise.all([
    safeCorpus(env),
    coverage(db),
    usage(db, at),
    all<{ channel: Channel; today: number; week: number }>(
      db,
      `SELECT channel, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today, COUNT(*) AS week
       FROM chat_logs WHERE created_at >= ? GROUP BY channel`,
      today,
      weekStart,
    ),
    first<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM chat_logs WHERE flagged = 1'),
    first<{ week: number; total: number }>(
      db,
      'SELECT SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS week, COUNT(*) AS total FROM chat_logs WHERE guarded = 1',
      weekStart,
    ),
    first<{ active: number; revoked: number }>(
      db,
      'SELECT SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN revoked_at IS NULL THEN 0 ELSE 1 END) AS revoked FROM api_keys',
    ),
    all<{ id: string; channel: Channel; question: string; created_at: number; flagged: number; guarded: number }>(
      db,
      'SELECT id, channel, question, created_at, flagged, guarded FROM chat_logs ORDER BY created_at DESC, id DESC LIMIT 10',
    ),
  ])

  const channelMap = new Map(channelRows.map((r) => [r.channel, r]))
  const todayUsage = usageDays[usageDays.length - 1]

  return {
    generatedAt: at,
    ...corpus,
    sourcesByKind: cov.byKind,
    coverage: cov.coverage,
    usage: usageDays,
    budget: { dailyTokens: getLimits(env).dailyTokenBudget, usedToday: todayUsage.tokensIn + todayUsage.tokensOut },
    channels: CHANNELS.map((channel) => ({
      channel,
      today: Number(channelMap.get(channel)?.today ?? 0),
      week: Number(channelMap.get(channel)?.week ?? 0),
    })),
    flagged: Number(flagged?.n ?? 0),
    guarded: { week: Number(guarded?.week ?? 0), total: Number(guarded?.total ?? 0) },
    corrections: cov.byKind.correction,
    keys: { active: Number(keys?.active ?? 0), revoked: Number(keys?.revoked ?? 0) },
    recent: recent.map((r) => ({
      id: r.id,
      channel: r.channel,
      question: r.question,
      createdAt: Number(r.created_at),
      flagged: Number(r.flagged) === 1,
      guarded: Number(r.guarded) === 1,
    })),
  }
}
