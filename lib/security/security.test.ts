import { describe, expect, it } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'
import {
  budgetRemaining,
  clientIdFromRequest,
  fitRateLimit,
  isSameOrigin,
  publicPostGuard,
  rateLimit,
  rateLimitAll,
  rateLimitSubject,
  readCapped,
  recordUsage,
  redactPii,
} from '@/lib/security'
import { timingSafeEqual } from '@/lib/security/crypto'

describe('rateLimit', () => {
  it('allows up to the limit inside one window, then blocks', async () => {
    const db = createTestD1()
    const at = 1_000_000
    const results: Awaited<ReturnType<typeof rateLimit>>[] = []
    for (let i = 0; i < 4; i++) results.push(await rateLimit(db, 'chat:a', 3, 60, at))
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false])
    expect(results[2].remaining).toBe(0)
  })

  it('resets when the window rolls over', async () => {
    const db = createTestD1()
    await rateLimit(db, 'b', 1, 60, 0)
    expect((await rateLimit(db, 'b', 1, 60, 1)).allowed).toBe(false)
    expect((await rateLimit(db, 'b', 1, 60, 61_000)).allowed).toBe(true)
  })

  it('rateLimitAll reports the first exhausted window', async () => {
    const db = createTestD1()
    const checks = [
      { bucket: 'h', limit: 5, windowSeconds: 3600 },
      { bucket: 'd', limit: 1, windowSeconds: 86400 },
    ]
    expect((await rateLimitAll(db, checks)).allowed).toBe(true)
    expect((await rateLimitAll(db, checks)).allowed).toBe(false)
  })
})

describe('budget', () => {
  it('tracks tokens per day', async () => {
    const db = createTestD1()
    const at = Date.UTC(2026, 8, 25)
    await recordUsage(db, 100, 50, at)
    await recordUsage(db, 10, 5, at)
    expect(await budgetRemaining(db, 1000, at)).toBe(835)
    expect(await budgetRemaining(db, 1000, at + 86_400_000)).toBe(1000)
  })
})

describe('clientIdFromRequest', () => {
  const req = (ip: string) => new Request('https://x.test/', { headers: { 'cf-connecting-ip': ip } })
  it('is stable within a day and rotates across days', async () => {
    const day = Date.UTC(2026, 8, 25, 12)
    const a = await clientIdFromRequest(req('1.2.3.4'), 's', day)
    expect(await clientIdFromRequest(req('1.2.3.4'), 's', day + 1000)).toBe(a)
    expect(await clientIdFromRequest(req('1.2.3.4'), 's', day + 86_400_000)).not.toBe(a)
    expect(await clientIdFromRequest(req('5.6.7.8'), 's', day)).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{20}$/)
  })

  it('gives every address in one IPv6 /64 the same id, and a neighbouring /64 a different one', async () => {
    const day = Date.UTC(2026, 8, 25, 12)
    const a = await clientIdFromRequest(req('2001:db8:1:2::1'), 's', day)
    expect(await clientIdFromRequest(req('2001:db8:1:2:dead:beef:0:1'), 's', day)).toBe(a)
    expect(await clientIdFromRequest(req('2001:db8:1:3::1'), 's', day)).not.toBe(a)
    expect(await clientIdFromRequest(req('::ffff:1.2.3.4'), 's', day)).toBe(await clientIdFromRequest(req('1.2.3.4'), 's', day))
  })
})

describe('isSameOrigin', () => {
  const at = (headers: Record<string, string>) => new Request('https://curlycloud.dev/api/chat', { method: 'POST', headers })

  it('passes same-origin browsers and header-less clients', () => {
    expect(isSameOrigin(at({}))).toBe(true)
    expect(isSameOrigin(at({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(isSameOrigin(at({ 'sec-fetch-site': 'same-origin', origin: 'https://curlycloud.dev' }))).toBe(true)
    expect(isSameOrigin(at({ origin: 'https://curlycloud.dev' }))).toBe(true)
  })

  it('refuses cross-site and same-site fetches, foreign origins, and null or malformed origins without throwing', () => {
    expect(isSameOrigin(at({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(isSameOrigin(at({ 'sec-fetch-site': 'same-site' }))).toBe(false)
    expect(isSameOrigin(at({ origin: 'https://evil.example' }))).toBe(false)
    expect(isSameOrigin(at({ 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' }))).toBe(false)
    expect(isSameOrigin(at({ origin: 'null' }))).toBe(false)
    expect(isSameOrigin(at({ origin: 'not a url' }))).toBe(false)
    expect(isSameOrigin(at({ origin: '' }))).toBe(false)
  })
})

describe('publicPostGuard', () => {
  const post = (headers: Record<string, string>) => new Request('https://curlycloud.dev/api/chat', { method: 'POST', headers, body: '{}' })

  it('lets same-origin JSON and header-less JSON through', () => {
    expect(publicPostGuard(post({ 'content-type': 'application/json' }))).toBeNull()
    expect(publicPostGuard(post({ 'content-type': 'Application/JSON; charset=utf-8', 'sec-fetch-site': 'same-origin' }))).toBeNull()
  })

  it('415s anything that is not application/json (the no-cors simple-request types)', () => {
    for (const type of ['text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx']) {
      expect(publicPostGuard(post({ 'content-type': type }))?.status, type).toBe(415)
    }
    expect(publicPostGuard(new Request('https://curlycloud.dev/api/chat', { method: 'POST' }))?.status).toBe(415)
  })

  it('403s cross-site browsers before looking at the body', () => {
    expect(publicPostGuard(post({ 'content-type': 'text/plain', 'sec-fetch-site': 'cross-site' }))?.status).toBe(403)
    expect(publicPostGuard(post({ 'content-type': 'application/json', origin: 'null' }))?.status).toBe(403)
  })
})

describe('readCapped', () => {
  /** A chunked body: no Content-Length, delivered in pieces. */
  function streamed(chunks: number, size: number): { request: Request; pulled: () => number } {
    let pulled = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= chunks) return controller.close()
        pulled++
        controller.enqueue(new Uint8Array(size).fill(0x61))
      },
    })
    const request = new Request('https://x.test/', { method: 'POST', body, duplex: 'half' } as RequestInit)
    return { request, pulled: () => pulled }
  }

  it('reads a body under the cap', async () => {
    expect(await readCapped(new Request('https://x.test/', { method: 'POST', body: 'héllo' }), 100)).toBe('héllo')
    expect(await readCapped(new Request('https://x.test/', { method: 'POST' }), 100)).toBe('')
  })

  it('refuses a declared Content-Length over the cap without reading', async () => {
    const request = new Request('https://x.test/', { method: 'POST', body: 'x', headers: { 'content-length': '999999' } })
    expect(await readCapped(request, 100)).toBeNull()
  })

  it('stops reading a chunked body as soon as it passes the cap', async () => {
    const { request, pulled } = streamed(1000, 1024)
    expect(request.headers.get('content-length')).toBeNull()
    expect(await readCapped(request, 64 * 1024)).toBeNull()
    expect(pulled()).toBeLessThan(80)
  })

  it('counts bytes, not characters', async () => {
    expect(await readCapped(new Request('https://x.test/', { method: 'POST', body: 'é'.repeat(60) }), 100)).toBeNull()
  })
})

describe('fitRateLimit', () => {
  const limits = { fitPerDay: 2, fitGlobalPerDay: 3 }

  it('limits each client, then everyone', async () => {
    const db = createTestD1()
    expect(await fitRateLimit(db, 'a', limits)).toEqual({ allowed: true })
    expect(await fitRateLimit(db, 'a', limits)).toEqual({ allowed: true })
    expect(await fitRateLimit(db, 'a', limits)).toMatchObject({ allowed: false, scope: 'client' })
    expect(await fitRateLimit(db, 'b', limits)).toEqual({ allowed: true })
    expect(await fitRateLimit(db, 'c', limits)).toMatchObject({ allowed: false, scope: 'global' })
  })

  it("doesn't let a client that is over its own limit burn the global cap", async () => {
    const db = createTestD1()
    for (let i = 0; i < 10; i++) await fitRateLimit(db, 'a', limits)
    const row = await db.prepare("SELECT count FROM rate_limits WHERE bucket = 'fit:all'").first<{ count: number }>()
    expect(row?.count).toBe(2)
    expect(await fitRateLimit(db, 'b', limits)).toEqual({ allowed: true })
  })
})

describe('rateLimitSubject', () => {
  it('keeps IPv4 per address', () => {
    expect(rateLimitSubject('203.0.113.7')).toBe('203.0.113.7')
    expect(rateLimitSubject(' 203.0.113.7 ')).toBe('203.0.113.7')
    expect(rateLimitSubject('203.0.113.8')).not.toBe(rateLimitSubject('203.0.113.7'))
  })

  it('groups IPv6 by /64, whatever the spelling', () => {
    const subject = '2001:db8:1:2::/64'
    for (const ip of [
      '2001:db8:1:2::1',
      '2001:db8:1:2:ffff:ffff:ffff:ffff',
      '2001:0DB8:0001:0002:0000:0000:0000:0001',
      '2001:db8:1:2:a:b:c:d',
      '2001:db8:1:2::',
      '[2001:db8:1:2::9]',
      '[2001:db8:1:2::9]:443',
      '2001:db8:1:2::9%eth0',
      '2001:db8:1:2:0:0:1.2.3.4',
    ]) {
      expect(rateLimitSubject(ip), ip).toBe(subject)
    }
    expect(rateLimitSubject('2001:db8:1:3::1')).toBe('2001:db8:1:3::/64')
    expect(rateLimitSubject('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64')
    expect(rateLimitSubject('::')).toBe('0:0:0:0::/64')
    expect(rateLimitSubject('fe80::1')).toBe('fe80:0:0:0::/64')
  })

  it('treats IPv4-mapped IPv6 as the IPv4 address', () => {
    expect(rateLimitSubject('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(rateLimitSubject('::FFFF:1.2.3.4')).toBe('1.2.3.4')
    expect(rateLimitSubject('::ffff:0102:0304')).toBe('1.2.3.4')
    expect(rateLimitSubject('0:0:0:0:0:ffff:102:304')).toBe('1.2.3.4')
    // Not mapped: IPv4-compatible and other embeddings stay IPv6.
    expect(rateLimitSubject('::1.2.3.4')).toBe('0:0:0:0::/64')
  })

  it('falls back to the raw (lowercased) value for anything malformed', () => {
    for (const bad of ['2001:db8:::1', '1::2::3', '1:2:3:4:5:6:7:8:9', '1:2:3:4::5:6:7:8', '12345::1', 'g::1', '::ffff:1.2.3.256', ':1.2.3.4', 'unknown']) {
      expect(rateLimitSubject(bad), bad).toBe(bad.toLowerCase())
    }
  })
})

describe('redactPii', () => {
  it('removes emails and phone numbers', () => {
    expect(redactPii('mail me at jane.doe@acme.co or call +1 (647) 555-0199 today')).toBe(
      'mail me at [email] or call [phone] today',
    )
  })
  it('leaves ordinary numbers alone', () => {
    expect(redactPii('hit@8 went from 96.7% to 91.3% in 2026')).toBe('hit@8 went from 96.7% to 91.3% in 2026')
  })
})

describe('timingSafeEqual', () => {
  it('compares strings', async () => {
    expect(await timingSafeEqual('abc', 'abc')).toBe(true)
    expect(await timingSafeEqual('abc', 'abd')).toBe(false)
    expect(await timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})
