import { describe, expect, it } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'
import {
  SESSION_COOKIE,
  createApiKey,
  createSessionToken,
  getAdminAuth,
  listApiKeys,
  requireAdmin,
  revokeApiKey,
  verifyApiKey,
  verifySessionToken,
} from '@/lib/auth'

const env = { ADMIN_TOKEN: 'admin-token-123', SESSION_SECRET: 'session-secret-xyz' }

describe('session tokens', () => {
  it('verifies a fresh token and rejects tampering and expiry', async () => {
    const at = Date.UTC(2026, 8, 25)
    const token = await createSessionToken(env.SESSION_SECRET, 60, at)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 1000)).toBe(true)
    expect(await verifySessionToken('other-secret', token, at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, token + 'x', at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 61_000)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, null, at)).toBe(false)
  })
})

describe('admin guard', () => {
  it('accepts the bearer token', async () => {
    const req = new Request('https://x.test/api/admin/stats', { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } })
    expect(await getAdminAuth(req, env)).toEqual({ via: 'token' })
  })

  it('rejects a wrong bearer token even with a valid cookie', async () => {
    const cookie = `${SESSION_COOKIE}=${await createSessionToken(env.SESSION_SECRET)}`
    const req = new Request('https://x.test/api/admin/stats', { headers: { authorization: 'Bearer nope', cookie } })
    expect(await getAdminAuth(req, env)).toBeNull()
  })

  it('accepts a session cookie and blocks cross-site mutations', async () => {
    const cookie = `${SESSION_COOKIE}=${await createSessionToken(env.SESSION_SECRET)}`
    const sameSite = new Request('https://x.test/api/admin/keys', { method: 'POST', headers: { cookie, 'sec-fetch-site': 'same-origin' } })
    const crossSite = new Request('https://x.test/api/admin/keys', { method: 'POST', headers: { cookie, 'sec-fetch-site': 'cross-site' } })
    expect(await requireAdmin(sameSite, env)).toBeNull()
    expect((await requireAdmin(crossSite, env))?.status).toBe(403)
  })

  it('returns 401 without credentials', async () => {
    expect((await requireAdmin(new Request('https://x.test/api/admin/stats'), env))?.status).toBe(401)
  })
})

describe('api keys', () => {
  it('creates, verifies, counts use and revokes', async () => {
    const db = createTestD1()
    const { token, record } = await createApiKey(db, 'Acme Corp', 200)
    expect(token.startsWith('rc_')).toBe(true)
    const verified = await verifyApiKey(db, token)
    expect(verified?.label).toBe('Acme Corp')
    expect(verified?.useCount).toBe(1)
    expect(await verifyApiKey(db, token + 'x')).toBeNull()
    expect(await revokeApiKey(db, record.id)).toBe(true)
    expect(await verifyApiKey(db, token)).toBeNull()
    const [listed] = await listApiKeys(db)
    expect(listed.revokedAt).not.toBeNull()
    // Plaintext is never stored.
    const raw = await db.prepare('SELECT * FROM api_keys').all()
    expect(JSON.stringify(raw.results)).not.toContain(token)
  })
})
