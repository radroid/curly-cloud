import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordUsage } from '@/lib/security'
import type { StudioStats } from '@/lib/studio/types'
import { controls, ingestSources, resetControls } from '@/lib/studio/tests/fake-rag'
import { json, req, resetEnv, seedLog, state } from '@/lib/studio/tests/harness'

vi.mock('@/lib/env', async (importOriginal) => {
  const { state } = await import('@/lib/studio/tests/harness')
  return { ...(await importOriginal<typeof import('@/lib/env')>()), getAppEnv: async () => state.env }
})
vi.mock('@/lib/rag', () => import('@/lib/studio/tests/fake-rag'))

const stats = await import('@/app/api/admin/stats/route')

async function getStats(): Promise<StudioStats> {
  const res = await stats.GET(await req('/api/admin/stats', { auth: 'token' }))
  expect(res.status).toBe(200)
  return json(res)
}

beforeEach(async () => {
  resetEnv()
  resetControls()
  const answers = ['principles', 'principles', 'principles', 'ai', 'ai', 'decisions', 'engineering', 'leadership', 'career', 'stories', 'origins']
  await ingestSources(state.env, [
    { id: 'resume:summary:1', kind: 'resume', visibility: 'public', title: 'Summary', topic: 'summary', body: 'AI engineer.' },
    ...answers.map((topic, i) => ({ id: `interview:${topic}-${i}`, kind: 'interview' as const, visibility: 'private' as const, title: `Q${i}`, topic, body: 'one two three four' })),
    { id: 'correction:log-a', kind: 'correction', visibility: 'private', title: 'Q', topic: 'notes', body: 'Fixed.' },
  ])
  const now = Date.now()
  await seedLog(state.env, { id: 'a', channel: 'web', guarded: true, flagged: true, createdAt: now - 1000 })
  await seedLog(state.env, { id: 'b', channel: 'mcp', createdAt: now - 2000 })
  await seedLog(state.env, { id: 'c', channel: 'web', createdAt: now - 3 * 86_400_000 })
  await seedLog(state.env, { id: 'old', channel: 'terminal', guarded: true, createdAt: now - 30 * 86_400_000 })
  await recordUsage(state.env.DB, 1200, 300)
  await recordUsage(state.env.DB, 100, 50, now - 2 * 86_400_000)
  await state.env.DB.prepare("INSERT INTO api_keys (id, label, prefix, token_hash, created_at, revoked_at) VALUES ('k1', 'A', 'rc_', 'h1', 0, NULL), ('k2', 'B', 'rc_', 'h2', 0, 5)").run()
})

describe('GET /api/admin/stats', () => {
  it('returns corpus stats, usage, channels, flags and recent questions', async () => {
    const s = await getStats()
    expect(s.corpus?.sources.interview).toBe(11)
    expect(s.corpusError).toBeUndefined()
    expect(s.sourcesByKind).toMatchObject({ resume: 1, interview: 11, correction: 1, note: 0, profile: 0 })
    expect(s.corrections).toBe(1)

    expect(s.usage).toHaveLength(14)
    expect(s.usage[13]).toMatchObject({ requests: 1, tokensIn: 1200, tokensOut: 300 })
    expect(s.usage[11]).toMatchObject({ requests: 1, tokensIn: 100 })
    expect(s.budget).toEqual({ dailyTokens: 3_000_000, usedToday: 1500 })

    const web = s.channels.find((c) => c.channel === 'web')
    expect(web).toEqual({ channel: 'web', today: expect.any(Number), week: 2 })
    expect(s.channels.find((c) => c.channel === 'terminal')?.week).toBe(0)
    expect(s.flagged).toBe(1)
    expect(s.guarded).toEqual({ week: 1, total: 2 })
    expect(s.keys).toEqual({ active: 1, revoked: 1 })
    expect(s.recent.map((r) => r.id)).toEqual(['a', 'b', 'c', 'old'])
    expect(s.recent[0]).toMatchObject({ channel: 'web', question: 'What do you build?', flagged: true, guarded: true })
  })

  it('computes interview coverage and marks the thinnest topics', async () => {
    const s = await getStats()
    const byTopic = Object.fromEntries(s.coverage.map((c) => [c.topic, c]))
    expect(byTopic.principles).toMatchObject({ sources: 3, words: 12, thin: false, origin: 'interview' })
    expect(byTopic.notes.sources).toBe(1)
    const thin = s.coverage.filter((c) => c.thin).map((c) => c.topic)
    expect(thin).toHaveLength(4)
    for (const t of thin) expect(byTopic[t].sources).toBe(0)
    expect(thin).not.toContain('notes')
    expect(thin).not.toContain('lightning')
  })

  it('degrades when lib/rag throws: corpus is null, everything else still works', async () => {
    controls.stubbed = true
    const s = await getStats()
    expect(s.corpus).toBeNull()
    expect(s.corpusError).toContain('not implemented')
    expect(s.sourcesByKind.interview).toBe(11)
    expect(s.recent).toHaveLength(4)
    expect(s.usage).toHaveLength(14)

    controls.stubbed = false
    controls.corpusFails = true
    const t = await getStats()
    expect(t.corpus).toBeNull()
    expect(t.corpusError).toBe('corpusStats exploded')
  })
})
