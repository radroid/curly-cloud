/**
 * Abuse guards on the public LLM routes (/api/chat, /api/fit): cross-site browsers, non-JSON
 * bodies, oversized chunked bodies, IPv6 rotation and the global fit cap.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestEnv, withVars, type TestEnv } from '@/lib/rag/testing'

let current: TestEnv

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>()
  return { ...actual, getAppEnv: async () => current }
})

const chat = await import('@/app/api/chat/route')
const fit = await import('@/app/api/fit/route')

const ORIGIN = 'https://curlycloud.test'
const CHAT = { messages: [{ role: 'user', content: 'What did you build at Eddy?' }], channel: 'web' }
const FIT = { roleTitle: 'AI Engineer', jobDescription: 'Build RAG pipelines and MCP servers in TypeScript.', company: 'Acme' }

function post(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** A chunked JSON body with no Content-Length: `{"messages":[…` padded far past the cap. */
function chunkedPost(path: string, totalBytes: number): { request: Request; pulled: () => number } {
  const enc = new TextEncoder()
  let sent = 0
  let pulls = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++
      if (sent === 0) {
        sent += 16
        return controller.enqueue(enc.encode('{"messages":[{"'))
      }
      if (sent >= totalBytes) return controller.close()
      sent += 4096
      controller.enqueue(enc.encode('a'.repeat(4096)))
    },
  })
  const request = new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
    body,
    duplex: 'half',
  } as RequestInit)
  return { request, pulled: () => pulls }
}

async function errorCode(res: Response): Promise<string> {
  return ((await res.json()) as { error: { code: string } }).error.code
}

beforeEach(async () => {
  current = createTestEnv({
    chat: 'I built the tracker [1].',
    json: {
      overall: { score: 4, verdict: 'promising', summary: 'Good fit.' },
      technical: { score: 4, summary: 'RAG and MCP.', strengths: ['RAG'], gaps: [], evidence: [1] },
      culture: { score: 3, summary: 'Some evidence.', strengths: [], gaps: [], evidence: [] },
      questionsForRaj: [],
      unknowns: [],
    },
  })
  const { seedPublicSources } = await import('@/lib/rag')
  await seedPublicSources(current)
})

describe.each([
  ['/api/chat', chat.POST, CHAT],
  ['/api/fit', fit.POST, FIT],
] as const)('%s abuse guards', (path, handler, valid) => {
  it('accepts same-origin JSON from the site and header-less clients', async () => {
    const browser = await handler(post(path, valid, { 'sec-fetch-site': 'same-origin', origin: ORIGIN }))
    expect(browser.status).toBe(200)
    await browser.text()
    const curl = await handler(post(path, valid, { 'cf-connecting-ip': '198.51.100.3' }))
    expect(curl.status).toBe(200)
    await curl.text()
  })

  it('415s text/plain and form bodies (what a no-cors cross-site fetch can send)', async () => {
    for (const type of ['text/plain;charset=UTF-8', 'application/x-www-form-urlencoded']) {
      const res = await handler(post(path, JSON.stringify(valid), { 'content-type': type }))
      expect(res.status, type).toBe(415)
      expect(await errorCode(res)).toBe('unsupported_media_type')
    }
  })

  it('403s cross-site browsers, foreign origins and Origin: null (never a 500)', async () => {
    const cases: Record<string, string>[] = [{ 'sec-fetch-site': 'cross-site' }, { origin: 'https://evil.example' }, { origin: 'null' }, { origin: '::bad::' }]
    for (const headers of cases) {
      const res = await handler(post(path, valid, headers))
      expect(res.status, JSON.stringify(headers)).toBe(403)
      expect(await errorCode(res)).toBe('forbidden')
    }
  })

  it('413s an oversized chunked body without reading all of it', async () => {
    const { request, pulled } = chunkedPost(path, 4 * 1024 * 1024)
    const res = await handler(request)
    expect(res.status).toBe(413)
    expect(await errorCode(res)).toBe('payload_too_large')
    expect(pulled()).toBeLessThan(40)
  })

  it('413s a declared Content-Length over the cap', async () => {
    const res = await handler(post(path, valid, { 'content-length': String(1024 * 1024) }))
    expect(res.status).toBe(413)
  })
})

describe('per-client limits group IPv6 by /64', () => {
  it('chat: rotating addresses inside one /64 shares one bucket', async () => {
    current = withVars(current, { CHAT_PER_HOUR: '2' })
    const from = (ip: string) => chat.POST(post('/api/chat', CHAT, { 'cf-connecting-ip': ip }))
    expect((await from('2001:db8:1:2::1')).status).toBe(200)
    expect((await from('2001:db8:1:2::2')).status).toBe(200)
    expect((await from('2001:db8:1:2:ffff::3')).status).toBe(429)
    expect((await from('2001:db8:1:3::1')).status).toBe(200)
  })

  it('fit: the same, per day', async () => {
    current = withVars(current, { FIT_PER_DAY: '1' })
    expect((await fit.POST(post('/api/fit', FIT, { 'cf-connecting-ip': '2001:db8:aa:bb::1' }))).status).toBe(200)
    expect((await fit.POST(post('/api/fit', FIT, { 'cf-connecting-ip': '2001:db8:aa:bb::99' }))).status).toBe(429)
  })
})

describe('global fit cap', () => {
  it('429s everyone once FIT_GLOBAL_PER_DAY is spent, whatever their address', async () => {
    current = withVars(current, { FIT_GLOBAL_PER_DAY: '2' })
    expect((await fit.POST(post('/api/fit', FIT, { 'cf-connecting-ip': '198.51.100.1' }))).status).toBe(200)
    expect((await fit.POST(post('/api/fit', FIT, { 'cf-connecting-ip': '198.51.100.2' }))).status).toBe(200)
    const res = await fit.POST(post('/api/fit', FIT, { 'cf-connecting-ip': '198.51.100.3' }))
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: { code: string; message: string } }
    expect(body.error).toMatchObject({ code: 'rate_limited', message: expect.stringContaining('daily limit') })
  })

  it('defaults to 150 when the var is missing', async () => {
    const { getLimits } = await import('@/lib/env')
    expect(getLimits({} as Parameters<typeof getLimits>[0]).fitGlobalPerDay).toBe(150)
    expect(getLimits({ FIT_GLOBAL_PER_DAY: '7' } as unknown as Parameters<typeof getLimits>[0]).fitGlobalPerDay).toBe(7)
  })
})
