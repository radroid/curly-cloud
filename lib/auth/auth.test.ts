import { beforeEach, describe, expect, it } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'
import {
  SESSION_COOKIE,
  createApiKey,
  createSessionToken,
  getAdminAuth,
  getSessionEpoch,
  listApiKeys,
  readSessionToken,
  requireAdmin,
  revokeAllSessions,
  revokeApiKey,
  verifyApiKey,
  verifySession,
  verifySessionToken,
} from '@/lib/auth'
import { hmacSha256, toBase64Url } from '@/lib/security/crypto'

const secrets = { ADMIN_TOKEN: 'admin-token-123', SESSION_SECRET: 'session-secret-xyz' }
let env: typeof secrets & { DB: D1Database }

beforeEach(() => {
  env = { ...secrets, DB: createTestD1() }
})

/** A correctly signed token with an arbitrary payload (e.g. the pre-v2 seconds format). */
async function signed(payload: unknown): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  return `${body}.${toBase64Url(await hmacSha256(secrets.SESSION_SECRET, body))}`
}

describe('session tokens', () => {
  it('verifies a fresh token and rejects tampering and expiry', async () => {
    const at = Date.UTC(2026, 8, 25)
    const token = await createSessionToken(env.SESSION_SECRET, 60, at)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 1000)).toBe(true)
    expect(await verifySessionToken('other-secret', token, at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, token + 'x', at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, token + '.extra', at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 61_000)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, null, at)).toBe(false)
  })

  it('carries the issue time in milliseconds (v2)', async () => {
    const at = Date.UTC(2026, 8, 25, 12, 0, 0, 123)
    const payload = await readSessionToken(env.SESSION_SECRET, await createSessionToken(env.SESSION_SECRET, 60, at), at)
    expect(payload).toEqual({ v: 2, sub: 'owner', iat: at, exp: at + 60_000 })
  })

  it('rejects old-format tokens (seconds, no version) even when correctly signed', async () => {
    const at = Date.UTC(2026, 8, 25)
    const old = await signed({ sub: 'owner', iat: Math.floor(at / 1000), exp: Math.floor(at / 1000) + 3600 })
    expect(await verifySessionToken(env.SESSION_SECRET, old, at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, await signed({ v: 2, sub: 'owner', exp: at + 1000 }), at)).toBe(false)
    expect(await verifySessionToken(env.SESSION_SECRET, await signed({ v: 2, sub: 'guest', iat: at, exp: at + 1000 }), at)).toBe(false)
  })

  it('verifySessionToken honours notBefore', async () => {
    const at = Date.UTC(2026, 8, 25)
    const token = await createSessionToken(env.SESSION_SECRET, 60, at)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 1, at - 1)).toBe(true)
    expect(await verifySessionToken(env.SESSION_SECRET, token, at + 1, at)).toBe(false)
  })
})

describe('session revocation (log out everywhere)', () => {
  it('revokes every session issued at or before the epoch, not later ones', async () => {
    const t = Date.UTC(2026, 8, 25, 12)
    const before = await createSessionToken(env.SESSION_SECRET, 3600, t - 5_000)
    const same = await createSessionToken(env.SESSION_SECRET, 3600, t)
    const after = await createSessionToken(env.SESSION_SECRET, 3600, t + 1)
    expect(await getSessionEpoch(env.DB)).toBe(0)
    expect(await verifySession(env, before, t)).toBe(true)

    await revokeAllSessions(env.DB, t)
    expect(await getSessionEpoch(env.DB)).toBe(t)
    expect(await verifySession(env, before, t + 10)).toBe(false)
    expect(await verifySession(env, same, t + 10)).toBe(false)
    expect(await verifySession(env, after, t + 10)).toBe(true)
  })

  it('getAdminAuth rejects a revoked cookie but still accepts the bearer token', async () => {
    const cookie = `${SESSION_COOKIE}=${await createSessionToken(env.SESSION_SECRET, 3600, Date.now() - 1000)}`
    const withCookie = new Request('https://x.test/api/admin/stats', { headers: { cookie } })
    expect(await getAdminAuth(withCookie, env)).toEqual({ via: 'session' })
    await revokeAllSessions(env.DB)
    expect(await getAdminAuth(withCookie, env)).toBeNull()
    expect((await requireAdmin(withCookie, env))?.status).toBe(401)
    const bearer = new Request('https://x.test/api/admin/stats', { headers: { authorization: `Bearer ${env.ADMIN_TOKEN}` } })
    expect(await getAdminAuth(bearer, env)).toEqual({ via: 'token' })
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
