import { describe, expect, it } from 'vitest'
import { createTestD1 } from '@/test/helpers/d1'
import { budgetRemaining, clientIdFromRequest, rateLimit, rateLimitAll, recordUsage, redactPii } from '@/lib/security'
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
