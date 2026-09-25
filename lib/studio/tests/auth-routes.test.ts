import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { ADMIN_PASSWORD, ORIGIN, SESSION_SECRET, json, resetEnv } from '@/lib/studio/tests/harness'

vi.mock('@/lib/env', async (importOriginal) => {
  const { state } = await import('@/lib/studio/tests/harness')
  return { ...(await importOriginal<typeof import('@/lib/env')>()), getAppEnv: async () => state.env }
})

const { POST: login } = await import('@/app/api/auth/login/route')
const { POST: logout } = await import('@/app/api/auth/logout/route')

function loginRequest(body: unknown, headers: Record<string, string> = {}, origin = ORIGIN): Request {
  return new Request(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-real-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function cookieValue(res: Response): string | null {
  const header = res.headers.get('set-cookie') ?? ''
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`))
  return match ? match[1] : null
}

beforeEach(() => {
  resetEnv()
})

describe('POST /api/auth/login', () => {
  it('sets a signed, HttpOnly, Secure session cookie for the right passphrase', async () => {
    const res = await login(loginRequest({ password: ADMIN_PASSWORD }))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ ok: true })
    const header = res.headers.get('set-cookie') ?? ''
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')
    expect(header).toContain('Secure')
    expect(await verifySessionToken(SESSION_SECRET, cookieValue(res))).toBe(true)
  })

  it('omits Secure over plain http (local dev)', async () => {
    const res = await login(loginRequest({ password: ADMIN_PASSWORD }, {}, 'http://localhost:3203'))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).not.toContain('Secure')
  })

  it('gives the same 401 for a wrong passphrase, a near miss and a malformed body', async () => {
    const wrong = await login(loginRequest({ password: 'nope' }))
    const close = await login(loginRequest({ password: ADMIN_PASSWORD.slice(0, -1) }))
    const malformed = await login(loginRequest('{not json'))
    for (const res of [wrong, close, malformed]) {
      expect(res.status).toBe(401)
      expect(res.headers.get('set-cookie')).toBeNull()
    }
    const bodies = await Promise.all([wrong, close, malformed].map((r) => r.text()))
    expect(new Set(bodies).size).toBe(1)
  })

  it('rate limits to 10 attempts per hour per client, even with the right passphrase', async () => {
    for (let i = 0; i < 10; i++) expect((await login(loginRequest({ password: 'guess' + i }))).status).toBe(401)
    const blocked = await login(loginRequest({ password: ADMIN_PASSWORD }))
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
    // A different client is unaffected.
    expect((await login(loginRequest({ password: ADMIN_PASSWORD }, { 'x-real-ip': '198.51.100.2' }))).status).toBe(200)
  })

  it('rejects cross-site posts before checking anything', async () => {
    const crossSite = await login(loginRequest({ password: ADMIN_PASSWORD }, { 'sec-fetch-site': 'cross-site' }))
    expect(crossSite.status).toBe(403)
    const foreignOrigin = new Request(`${ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    })
    expect((await login(foreignOrigin)).status).toBe(403)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie for fetch callers', async () => {
    const res = await logout(new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`))
  })

  it('redirects plain form posts back to the login page', async () => {
    const res = await logout(
      new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { 'sec-fetch-site': 'same-origin', accept: 'text/html' } }),
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/studio/login')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects cross-site logout', async () => {
    const res = await logout(new Request(`${ORIGIN}/api/auth/logout`, { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } }))
    expect(res.status).toBe(403)
  })
})
