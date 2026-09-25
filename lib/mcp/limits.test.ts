/** assess_fit limits are shared between the website (/api/fit) and MCP, plus one global cap. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiKey } from '@/lib/auth'
import { gateLlmCall } from '@/lib/mcp/limits'
import { createTestEnv, withVars, type TestEnv } from '@/lib/rag/testing'
import { clientIdFromRequest } from '@/lib/security'

let current: TestEnv

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>()
  return { ...actual, getAppEnv: async () => current }
})

const fit = await import('@/app/api/fit/route')

const IP = '203.0.113.7'
const FIT = { roleTitle: 'AI Engineer', jobDescription: 'Build RAG pipelines and MCP servers in TypeScript.' }

function webFit(ip = IP): Promise<Response> {
  return fit.POST(
    new Request('https://curlycloud.test/api/fit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(FIT),
    }),
  )
}

/** The id lib/mcp/http.ts gives an anonymous caller from `ip`. */
function anonClientId(ip = IP): Promise<string> {
  return clientIdFromRequest(new Request('https://curlycloud.test/mcp', { headers: { 'cf-connecting-ip': ip } }), current.SESSION_SECRET)
}

function errorOf(result: Awaited<ReturnType<typeof gateLlmCall>>): { code: string; text: string } | null {
  if (!result) return null
  return { code: (result._meta?.['curlycloud.dev/error'] as { code: string }).code, text: (result.content[0] as { text: string }).text }
}

beforeEach(async () => {
  current = createTestEnv({
    json: {
      overall: { score: 4, verdict: 'promising', summary: 'Good fit.' },
      technical: { score: 4, summary: 'x', strengths: [], gaps: [], evidence: [] },
      culture: { score: 3, summary: 'x', strengths: [], gaps: [], evidence: [] },
      questionsForRaj: [],
      unknowns: [],
    },
  })
  const { seedPublicSources } = await import('@/lib/rag')
  await seedPublicSources(current)
})

describe('assess_fit limits', () => {
  it('an anonymous MCP caller shares the website bucket for its IP', async () => {
    current = withVars(current, { FIT_PER_DAY: '1' })
    expect((await webFit()).status).toBe(200)
    const denied = errorOf(await gateLlmCall({ env: current, clientId: await anonClientId(), key: null }, 'assess_fit'))
    expect(denied?.code).toBe('fit_limited')
    expect(denied?.text).toContain('assess_fit is limited to 1 calls per day')
    // ask_raj is a different limit.
    expect(await gateLlmCall({ env: current, clientId: await anonClientId(), key: null }, 'ask_raj')).toBeNull()
    // …and the reverse: MCP first, then the website from the same IP.
    expect(await gateLlmCall({ env: current, clientId: await anonClientId('198.51.100.4'), key: null }, 'assess_fit')).toBeNull()
    expect((await webFit('198.51.100.4')).status).toBe(429)
  })

  it('a keyed MCP caller uses its key bucket, not the IP bucket', async () => {
    current = withVars(current, { FIT_PER_DAY: '1' })
    const { record } = await createApiKey(current.DB, 'Acme', 100)
    expect((await webFit()).status).toBe(200)
    const ctx = { env: current, clientId: `key:${record.id}`, key: record }
    expect(await gateLlmCall(ctx, 'assess_fit')).toBeNull()
    expect(errorOf(await gateLlmCall(ctx, 'assess_fit'))?.code).toBe('fit_limited')
    const rows = await current.DB.prepare("SELECT bucket FROM rate_limits WHERE bucket LIKE 'fit:%' ORDER BY bucket").all<{ bucket: string }>()
    expect(rows.results.map((r) => r.bucket)).toEqual(['fit:all', expect.stringMatching(/^fit:day:[0-9a-f]{20}$/), `fit:day:key:${record.id}`])
  })

  it('the global cap covers the website and MCP, and says a key will not help', async () => {
    current = withVars(current, { FIT_GLOBAL_PER_DAY: '2' })
    const { record } = await createApiKey(current.DB, 'Acme', 100)
    expect((await webFit()).status).toBe(200)
    expect(await gateLlmCall({ env: current, clientId: await anonClientId('198.51.100.5'), key: null }, 'assess_fit')).toBeNull()
    const denied = errorOf(await gateLlmCall({ env: current, clientId: `key:${record.id}`, key: record }, 'assess_fit'))
    expect(denied?.code).toBe('fit_limited')
    expect(denied?.text).toContain('across all clients')
    expect(denied?.text).toContain("An API key doesn't raise this limit")
    expect((await webFit('198.51.100.6')).status).toBe(429)
  })
})
