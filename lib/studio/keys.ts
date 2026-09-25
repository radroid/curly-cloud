import { listApiKeys } from '@/lib/auth'
import { all } from '@/lib/db'
import type { KeyItem } from '@/lib/studio/types'

const DAY_MS = 86_400_000

/** Start of the current fixed daily window, matching `rateLimit(..., 86400)` in lib/security. */
export function dayWindowStart(at: number = Date.now()): number {
  return Math.floor(at / DAY_MS) * DAY_MS
}

/** Keys with today's usage: the MCP stream's `mcp:k:<id>` bucket plus chat_logs counts by key. */
export async function listKeysWithUsage(db: D1Database, at: number = Date.now()): Promise<KeyItem[]> {
  const today = dayWindowStart(at)
  const [keys, buckets, counts] = await Promise.all([
    listApiKeys(db),
    all<{ bucket: string; window_start: number; count: number }>(
      db,
      "SELECT bucket, window_start, count FROM rate_limits WHERE bucket LIKE 'mcp:k:%'",
    ),
    all<{ key_id: string; total: number; today: number; last: number | null }>(
      db,
      `SELECT key_id, COUNT(*) AS total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today, MAX(created_at) AS last
       FROM chat_logs WHERE key_id IS NOT NULL GROUP BY key_id`,
      today,
    ),
  ])
  const usedToday = new Map<string, number>()
  for (const b of buckets) {
    if (Number(b.window_start) === today) usedToday.set(b.bucket.slice('mcp:k:'.length), Number(b.count))
  }
  const byKey = new Map(counts.map((c) => [c.key_id, c]))
  return keys.map((k) => {
    const c = byKey.get(k.id)
    return {
      ...k,
      usedToday: usedToday.get(k.id) ?? 0,
      questionsToday: Number(c?.today ?? 0),
      questionsTotal: Number(c?.total ?? 0),
      lastQuestionAt: c?.last == null ? null : Number(c.last),
    }
  })
}
