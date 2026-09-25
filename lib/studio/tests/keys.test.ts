import { beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyApiKey } from '@/lib/auth'
import { rateLimit } from '@/lib/security'
import type { KeyItem } from '@/lib/studio/types'
import { ctx, json, req, resetEnv, seedLog, state } from '@/lib/studio/tests/harness'

vi.mock('@/lib/env', async (importOriginal) => {
  const { state } = await import('@/lib/studio/tests/harness')
  return { ...(await importOriginal<typeof import('@/lib/env')>()), getAppEnv: async () => state.env }
})
vi.mock('@/lib/rag', () => import('@/lib/studio/tests/fake-rag'))

const keys = await import('@/app/api/admin/keys/route')
const key = await import('@/app/api/admin/keys/[id]/route')

beforeEach(() => {
  resetEnv()
})

describe('/api/admin/keys', () => {
  it('creates a key and shows the token exactly once', async () => {
    const res = await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'session', body: { label: 'Acme Recruiting', dailyLimit: 50 } }))
    expect(res.status).toBe(201)
    const { token, record } = await json(res)
    expect(token).toMatch(/^rc_/)
    expect(record).toMatchObject({ label: 'Acme Recruiting', dailyLimit: 50, revokedAt: null, prefix: token.slice(0, 10) })
    expect((await verifyApiKey(state.env.DB, token))?.id).toBe(record.id)

    const listed = await keys.GET(await req('/api/admin/keys', { auth: 'token' }))
    const text = await listed.text()
    expect(text).not.toContain(token)
    expect(text).not.toContain('token_hash')
    expect(JSON.parse(text).items).toHaveLength(1)
  })

  it("includes today's MCP bucket usage and question counts per key", async () => {
    const { record } = await json(await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'token', body: { label: 'Acme' } })))
    const other = await json(await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'token', body: { label: 'Globex' } })))
    for (let i = 0; i < 3; i++) await rateLimit(state.env.DB, `mcp:k:${record.id}`, 500, 86_400)
    // A stale bucket from yesterday's window doesn't count.
    await state.env.DB.prepare('INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, 0, 99)').bind(`mcp:k:${other.record.id}`).run()
    await seedLog(state.env, { id: 'l1', channel: 'mcp', keyId: record.id })
    await seedLog(state.env, { id: 'l2', channel: 'mcp', keyId: record.id, createdAt: Date.now() - 3 * 86_400_000 })

    const { items } = await json<{ items: KeyItem[] }>(await keys.GET(await req('/api/admin/keys', { auth: 'token' })))
    const acme = items.find((k) => k.id === record.id)
    const globex = items.find((k) => k.id === other.record.id)
    expect(acme).toMatchObject({ usedToday: 3, questionsToday: 1, questionsTotal: 2, dailyLimit: 500 })
    expect(acme?.lastQuestionAt).toBeGreaterThan(0)
    expect(globex).toMatchObject({ usedToday: 0, questionsToday: 0, questionsTotal: 0, lastQuestionAt: null })
  })

  it('validates the new key body', async () => {
    expect((await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'token', body: {} }))).status).toBe(400)
    expect((await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'token', body: { label: 'x', dailyLimit: 0 } }))).status).toBe(400)
  })

  it('revokes once, then 404s', async () => {
    const { token, record } = await json(await keys.POST(await req('/api/admin/keys', { method: 'POST', auth: 'token', body: { label: 'Acme' } })))
    const res = await key.DELETE(await req(`/api/admin/keys/${record.id}`, { method: 'DELETE', auth: 'session' }), ctx(record.id))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ revoked: true })
    expect(await verifyApiKey(state.env.DB, token)).toBeNull()
    expect((await key.DELETE(await req(`/api/admin/keys/${record.id}`, { method: 'DELETE', auth: 'token' }), ctx(record.id))).status).toBe(404)
    const { items } = await json<{ items: KeyItem[] }>(await keys.GET(await req('/api/admin/keys', { auth: 'token' })))
    expect(items[0].revokedAt).not.toBeNull()
  })
})
