/**
 * Drives the real route handlers with JSON-RPC over Requests (and the SDK's own client), against
 * an in-memory D1. lib/rag is mocked with canned answers; lib/env returns a test env.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { createTestD1 } from '@/test/helpers/d1'
import { createApiKey, revokeApiKey } from '@/lib/auth'
import { recordUsage } from '@/lib/security'
import type { Answer, CitationSource, FitAssessment, TopicSummary } from '@/lib/rag/types'

const h = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  answer: vi.fn(),
  assessFit: vi.fn(),
  listTopics: vi.fn(),
}))

vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn() }))
vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  getAppEnv: async () => h.env,
}))
vi.mock('@/lib/rag', () => ({ answer: h.answer, assessFit: h.assessFit, listTopics: h.listTopics }))

import { DELETE, GET, OPTIONS, POST } from '@/app/api/mcp/route'
import { GET as getLlmsTxt } from '@/app/llms.txt/route'
import { RESUME_URI } from '@/lib/mcp/server'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PRIVATE_TEXT = 'SECRET PRIVATE INTERVIEW TEXT'

const publicSource: CitationSource = {
  n: 1,
  id: 'resume:exp:eddy:mcp',
  kind: 'resume',
  visibility: 'public',
  title: 'Resume · Eddy Solutions',
  topic: 'experience',
  anchor: 'r-exp-eddy-mcp',
  snippet: 'Built and run the company MCP server.',
}

// The mock deliberately leaks a private snippet to prove the MCP layer strips it.
const privateSource: CitationSource = {
  n: 2,
  id: 'interview:principles-004',
  kind: 'interview',
  visibility: 'private',
  title: 'What will you not compromise on?',
  topic: 'principles',
  anchor: 'should-not-leak',
  snippet: PRIVATE_TEXT,
}

const cannedAnswer: Answer = {
  text: 'I built the MCP server at Eddy [1], and reliability comes first for me [2].',
  sources: [publicSource, privateSource],
  cited: [1, 2],
  provider: 'workers-ai',
  model: '@cf/meta/llama-4-scout-17b-16e-instruct',
  latencyMs: 12,
  guarded: false,
  logId: 'log_1',
}

const cannedFit: FitAssessment = {
  roleTitle: 'Senior AI Engineer',
  company: 'Acme',
  overall: { score: 4, verdict: 'promising', summary: 'Strong on MCP and RAG; unclear on scale.' },
  technical: { score: 4, summary: 'Ships MCP and RAG.', strengths: ['MCP servers in production'], gaps: ['No Rust'], evidence: [1] },
  culture: { score: 3, summary: 'Values reliability.', strengths: ['Owns outcomes'], gaps: [], evidence: [2] },
  questionsForRaj: ['How do you feel about on-call?'],
  unknowns: ['Kubernetes experience'],
  sources: [publicSource, privateSource],
  provider: 'workers-ai',
  model: '@cf/meta/llama-4-scout-17b-16e-instruct',
  logId: 'log_2',
}

const liveTopicList: TopicSummary[] = [
  { topic: 'experience', label: 'Experience', count: 22 },
  { topic: 'principles', label: 'Principles & values', count: 7 },
]

function makeEnv(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DB: createTestD1(),
    SESSION_SECRET: 'test-session-secret',
    CHAT_PER_HOUR: '30',
    CHAT_PER_DAY: '120',
    FIT_PER_DAY: '10',
    MCP_ANON_PER_DAY: '40',
    DAILY_TOKEN_BUDGET: '3000000',
    MCP_REQUIRE_KEY: 'false',
    ...overrides,
  }
}

const db = (): D1Database & { sqlite: import('node:sqlite').DatabaseSync } => h.env.DB as never

function rateRows(): { bucket: string; count: number }[] {
  return db().sqlite.prepare('SELECT bucket, count FROM rate_limits ORDER BY bucket').all() as never
}

// ── JSON-RPC helpers ─────────────────────────────────────────────────────────

const ENDPOINT = 'https://curlycloud.dev/mcp'
let nextId = 1

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
      'cf-connecting-ip': '203.0.113.7',
      ...headers,
    },
    body,
  })
}

async function rpc(method: string, params: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const res = await POST(request(JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }), headers))
  return { res, body: (await res.json()) as { result?: any; error?: { code: number; message: string } } }
}

async function callTool(name: string, args: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const { body } = await rpc('tools/call', { name, arguments: args }, headers)
  return body.result as { content: { type: string; text: string }[]; structuredContent?: any; isError?: boolean; _meta?: any }
}

const text = (r: { content: { text: string }[] }): string => r.content.map((c) => c.text).join('\n')

beforeEach(() => {
  h.env = makeEnv()
  h.answer.mockReset().mockResolvedValue(cannedAnswer)
  h.assessFit.mockReset().mockResolvedValue(cannedFit)
  h.listTopics.mockReset().mockRejectedValue(new Error('lib/rag.listTopics is not implemented yet'))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Protocol ─────────────────────────────────────────────────────────────────

describe('MCP over JSON-RPC', () => {
  it('initializes with instructions and the latest protocol version', async () => {
    const { res, body } = await rpc('initialize', {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('mcp-session-id')).toBeNull()
    expect(body.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION)
    expect(body.result.serverInfo.name).toBe('raj-dholakia')
    expect(Object.keys(body.result.capabilities)).toEqual(expect.arrayContaining(['tools', 'resources', 'prompts']))
    const instructions: string = body.result.instructions
    expect(instructions).toContain('AI clone')
    expect(instructions).toMatch(/get_profile[\s\S]*assess_fit[\s\S]*ask_raj/)
    expect(instructions).toContain('raj9dholakia@gmail.com')
  })

  it('negotiates down for older clients', async () => {
    const { body } = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'old', version: '0' } })
    expect(body.result.protocolVersion).toBe('2025-03-26')
  })

  it('accepts notifications with 202', async () => {
    const res = await POST(request(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })))
    expect(res.status).toBe(202)
  })

  it('lists five read-only tools with schemas and annotations', async () => {
    const { body } = await rpc('tools/list')
    const tools = body.result.tools as any[]
    expect(tools.map((t) => t.name).sort()).toEqual(['ask_raj', 'assess_fit', 'get_profile', 'get_resume', 'list_topics'])
    for (const t of tools) {
      expect(t.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false })
      expect(t.description.length).toBeGreaterThan(40)
    }
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    for (const name of ['get_profile', 'get_resume', 'list_topics']) expect(byName[name].annotations.idempotentHint).toBe(true)
    expect(byName.ask_raj.inputSchema.properties.question.maxLength).toBe(1000)
    expect(byName.ask_raj.inputSchema.properties.context.maxLength).toBe(2000)
    expect(byName.ask_raj.inputSchema.required).toEqual(['question'])
    expect(byName.ask_raj.outputSchema.required).toEqual(expect.arrayContaining(['answer', 'sources', 'cited', 'provider', 'model']))
    expect(byName.assess_fit.inputSchema.properties.job_description.maxLength).toBe(12000)
    expect(byName.assess_fit.inputSchema.required.sort()).toEqual(['job_description', 'role_title'])
    expect(byName.assess_fit.outputSchema).toBeDefined()
    expect(byName.get_resume.inputSchema.properties.format.enum).toEqual(['markdown', 'json'])
  })

  it('lists and reads the resume resource', async () => {
    const list = await rpc('resources/list')
    expect(list.body.result.resources).toEqual([expect.objectContaining({ uri: RESUME_URI, mimeType: 'text/markdown' })])
    const { body } = await rpc('resources/read', { uri: RESUME_URI })
    const [content] = body.result.contents
    expect(content).toMatchObject({ uri: RESUME_URI, mimeType: 'text/markdown' })
    expect(content.text).toContain('# Raj Dholakia')
    expect(content.text).toContain('## Experience')
  })

  it('serves the evaluate_candidate prompt', async () => {
    const list = await rpc('prompts/list')
    const [prompt] = list.body.result.prompts
    expect(prompt.name).toBe('evaluate_candidate')
    expect(prompt.arguments).toEqual([
      expect.objectContaining({ name: 'role_title', required: true }),
      expect.objectContaining({ name: 'job_description', required: false }),
      expect.objectContaining({ name: 'company', required: false }),
    ])
    const { body } = await rpc('prompts/get', {
      name: 'evaluate_candidate',
      arguments: { role_title: 'Staff AI Engineer', company: 'Acme', job_description: 'Build agent infrastructure.' },
    })
    const message = body.result.messages[0]
    expect(message.role).toBe('user')
    const plan: string = message.content.text
    expect(plan).toContain('Staff AI Engineer at Acme')
    expect(plan).toContain('Build agent infrastructure.')
    expect(plan).toMatch(/get_profile[\s\S]*assess_fit[\s\S]*ask_raj/)
    expect(plan).toContain('Recommendation')
    expect(plan).toContain('Open questions')
  })
})

// ── Tools ────────────────────────────────────────────────────────────────────

describe('free tools', () => {
  it('get_profile returns the public profile with the static topic list when listTopics throws', async () => {
    const r = await callTool('get_profile')
    expect(r.isError).toBeUndefined()
    expect(r.structuredContent).toMatchObject({
      name: 'Raj Dholakia',
      email: 'raj9dholakia@gmail.com',
      location: 'Toronto, ON',
      topicsSource: 'static',
      currentRole: { company: 'Eddy Solutions' },
    })
    expect(r.structuredContent.skills.length).toBeGreaterThan(3)
    expect(r.structuredContent.topics.find((t: any) => t.topic === 'ai')).toMatchObject({ count: null })
    expect(text(r)).toContain('How to reach Raj')
    expect(rateRows()).toEqual([])
  })

  it('get_profile uses live topics when available', async () => {
    h.listTopics.mockResolvedValue(liveTopicList)
    const r = await callTool('get_profile')
    expect(r.structuredContent.topicsSource).toBe('live')
    expect(r.structuredContent.topics).toEqual([
      { topic: 'experience', label: 'Experience', blurb: 'Roles from 2020 to now, with outcomes.', count: 22 },
      { topic: 'principles', label: 'Principles & values', blurb: expect.any(String), count: 7 },
    ])
  })

  it('get_resume returns markdown by default and JSON on request', async () => {
    const md = await callTool('get_resume')
    expect(text(md)).toContain('# Raj Dholakia')
    expect(md.structuredContent).toBeUndefined()
    const json = await callTool('get_resume', { format: 'json' })
    expect(json.structuredContent.name).toBe('Raj Dholakia')
    expect(JSON.parse(text(json)).experience[0].company).toBe('Eddy Solutions')
  })

  it('list_topics lists topics with a note', async () => {
    h.listTopics.mockResolvedValue(liveTopicList)
    const r = await callTool('list_topics')
    expect(r.structuredContent.source).toBe('live')
    expect(r.structuredContent.topics).toHaveLength(2)
    expect(r.structuredContent.note).toMatch(/work well/)
    expect(text(r)).toContain('Principles & values')
  })

  it('list_topics falls back to the static list when the corpus is empty', async () => {
    h.listTopics.mockResolvedValue([])
    const r = await callTool('list_topics')
    expect(r.structuredContent.source).toBe('static')
    expect(r.structuredContent.topics.length).toBeGreaterThan(10)
  })
})

describe('ask_raj', () => {
  it('answers with sources, and private text never leaves the server', async () => {
    const { res, body } = await rpc('tools/call', { name: 'ask_raj', arguments: { question: 'What did you build at Eddy?' } })
    const r = body.result
    expect(r.isError).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(PRIVATE_TEXT)
    expect(JSON.stringify(body)).not.toContain('should-not-leak')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')

    const t = text(r)
    expect(t).toContain(cannedAnswer.text)
    expect(t).toContain('[1] Resume · Eddy Solutions — resume/experience (resume section: Experience, https://curlycloud.dev/#r-exp-eddy-mcp)')
    expect(t).toContain('[2] What will you not compromise on? — interview/principles (private')
    expect(t).toContain('AI-generated')

    expect(r.structuredContent).toMatchObject({ answer: cannedAnswer.text, cited: [1, 2], provider: 'workers-ai', guarded: false })
    const [pub, priv] = r.structuredContent.sources
    expect(pub).toMatchObject({ snippet: publicSource.snippet, url: 'https://curlycloud.dev/#r-exp-eddy-mcp', section: 'Experience', cited: true })
    expect(priv).toMatchObject({ visibility: 'private', snippet: null, url: null, section: null, title: privateSource.title })

    expect(h.answer).toHaveBeenCalledWith(h.env, {
      messages: [{ role: 'user', content: 'What did you build at Eddy?' }],
      channel: 'mcp',
      clientId: expect.stringMatching(/^[0-9a-f]{20}$/),
      keyId: null,
    })
    expect(rateRows()).toEqual([{ bucket: expect.stringMatching(/^mcp:a:[0-9a-f]{20}$/), count: 1 }])
  })

  it('passes context as a framing turn before the question', async () => {
    await callTool('ask_raj', { question: 'Why this role?', context: 'Evaluating for Staff AI Engineer at Acme' })
    const { messages } = h.answer.mock.calls[0][1]
    expect(messages).toHaveLength(3)
    expect(messages[0]).toEqual({ role: 'user', content: expect.stringContaining('Staff AI Engineer at Acme') })
    expect(messages[1].role).toBe('assistant')
    expect(messages[2]).toEqual({ role: 'user', content: 'Why this role?' })
    expect(messages[0].content.length).toBeLessThanOrEqual(1000)
  })

  it('rejects over-long questions as a tool error without counting them', async () => {
    const r = await callTool('ask_raj', { question: 'x'.repeat(1001) })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/question/i)
    expect(h.answer).not.toHaveBeenCalled()
    expect(rateRows()).toEqual([])
  })

  it('returns a graceful "unavailable" error when lib/rag throws', async () => {
    h.answer.mockRejectedValue(new Error('lib/rag.answer is not implemented yet'))
    const r = await callTool('ask_raj', { question: 'Hello?' })
    expect(r.isError).toBe(true)
    expect(r.structuredContent).toBeUndefined()
    expect(text(r)).toMatch(/unavailable/)
    expect(text(r)).toContain('get_profile')
    expect(text(r)).not.toContain('not implemented')
    expect(r._meta['curlycloud.dev/error'].code).toBe('unavailable')
  })

  it('maps a budget error from lib/rag', async () => {
    h.answer.mockRejectedValue(Object.assign(new Error('over budget'), { code: 'budget_exceeded' }))
    const r = await callTool('ask_raj', { question: 'Hello?' })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/daily AI budget/)
  })

  it('refuses before calling the model when the daily budget is spent', async () => {
    await recordUsage(db(), 3_000_000, 1)
    const r = await callTool('ask_raj', { question: 'Hello?' })
    expect(r.isError).toBe(true)
    expect(r._meta['curlycloud.dev/error'].code).toBe('budget_exceeded')
    expect(h.answer).not.toHaveBeenCalled()
  })

  it('rate limits anonymous callers per day with a retry hint, leaving free tools usable', async () => {
    h.env = makeEnv({ MCP_ANON_PER_DAY: '2' })
    expect((await callTool('ask_raj', { question: 'one' })).isError).toBeUndefined()
    expect((await callTool('ask_raj', { question: 'two' })).isError).toBeUndefined()
    const r = await callTool('ask_raj', { question: 'three' })
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/Rate limited: anonymous clients get 2 ask_raj\/assess_fit calls per day. Retry in about \d+/)
    expect(text(r)).toContain('API key')
    expect(r._meta['curlycloud.dev/error']).toMatchObject({ code: 'rate_limited', retryAfterSeconds: expect.any(Number) })
    expect(h.answer).toHaveBeenCalledTimes(2)
    // A different client (IP) still has its own allowance, and free tools keep working.
    expect((await callTool('ask_raj', { question: 'four' }, { 'cf-connecting-ip': '198.51.100.9' })).isError).toBeUndefined()
    expect((await callTool('get_profile')).isError).toBeUndefined()
  })
})

describe('assess_fit', () => {
  const args = { role_title: 'Senior AI Engineer', job_description: 'Build MCP servers and RAG. Rust a plus.', company: 'Acme' }

  it('returns the assessment as structured content and a markdown summary', async () => {
    const r = await callTool('assess_fit', { ...args, culture_notes: 'Small team, remote.' })
    expect(r.isError).toBeUndefined()
    expect(r.structuredContent).toMatchObject({
      roleTitle: 'Senior AI Engineer',
      company: 'Acme',
      overall: { verdict: 'promising', score: 4 },
      technical: { score: 4, gaps: ['No Rust'], evidence: [1] },
      culture: { score: 3 },
      unknowns: ['Kubernetes experience'],
      questionsForRaj: ['How do you feel about on-call?'],
    })
    expect(r.structuredContent.logId).toBeUndefined()
    expect(r.structuredContent.sources[1]).toMatchObject({ snippet: null, visibility: 'private' })
    const t = text(r)
    expect(t).toContain('## Fit assessment: Senior AI Engineer at Acme')
    expect(t).toContain('**Overall: promising (4/5).**')
    expect(t).toContain('### Technical fit: 4/5')
    expect(t).toContain('### Culture fit: 3/5')
    expect(t).toContain('- Kubernetes experience')
    expect(t).toContain('- How do you feel about on-call?')
    expect(t).toContain('Evidence: [1]')
    expect(JSON.stringify(r)).not.toContain(PRIVATE_TEXT)
    expect(h.assessFit).toHaveBeenCalledWith(h.env, {
      roleTitle: 'Senior AI Engineer',
      jobDescription: args.job_description,
      company: 'Acme',
      cultureNotes: 'Small team, remote.',
      channel: 'mcp',
      clientId: expect.any(String),
      keyId: null,
    })
    expect(rateRows().map((r) => r.bucket)).toEqual([expect.stringMatching(/^fit:/), expect.stringMatching(/^mcp:a:/)])
  })

  it('clamps out-of-range model output so it still matches the schema', async () => {
    h.assessFit.mockResolvedValue({ ...cannedFit, overall: { score: 9, verdict: 'amazing', summary: 'x' } })
    const r = await callTool('assess_fit', args)
    expect(r.isError).toBeUndefined()
    expect(r.structuredContent.overall).toEqual({ score: 5, verdict: 'mixed', summary: 'x' })
  })

  it('has its own, smaller daily limit', async () => {
    h.env = makeEnv({ FIT_PER_DAY: '1' })
    expect((await callTool('assess_fit', args)).isError).toBeUndefined()
    const r = await callTool('assess_fit', args)
    expect(r.isError).toBe(true)
    expect(text(r)).toContain('assess_fit is limited to 1 calls per day')
    expect(r._meta['curlycloud.dev/error'].code).toBe('fit_limited')
    // ask_raj is still allowed.
    expect((await callTool('ask_raj', { question: 'Hi' })).isError).toBeUndefined()
  })

  it('returns "unavailable" when lib/rag throws', async () => {
    h.assessFit.mockRejectedValue(new Error('boom'))
    const r = await callTool('assess_fit', args)
    expect(r.isError).toBe(true)
    expect(text(r)).toMatch(/unavailable/)
  })
})

// ── Auth and limits ──────────────────────────────────────────────────────────

describe('API keys', () => {
  it('rejects an invalid key with 401, a JSON-RPC error and WWW-Authenticate', async () => {
    const { res, body } = await rpc('tools/list', {}, { authorization: 'Bearer rc_not_a_real_key' })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer realm="curlycloud.dev", error="invalid_token"/)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(body).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32001, message: expect.stringContaining('Invalid or revoked API key') } })
  })

  it('rejects a revoked key and a non-Bearer scheme', async () => {
    const { token, record } = await createApiKey(db(), 'Acme')
    await revokeApiKey(db(), record.id)
    expect((await rpc('tools/list', {}, { authorization: `Bearer ${token}` })).res.status).toBe(401)
    expect((await rpc('tools/list', {}, { authorization: 'Basic dXNlcjpwYXNz' })).res.status).toBe(401)
  })

  it('treats an empty bearer token as anonymous', async () => {
    const { res } = await rpc('tools/list', {}, { authorization: 'Bearer ' })
    expect(res.status).toBe(200)
  })

  it('requires a key when MCP_REQUIRE_KEY is on, and explains how to get one', async () => {
    h.env = makeEnv({ MCP_REQUIRE_KEY: 'true' })
    const { res, body } = await rpc('initialize', { protocolVersion: LATEST_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 't', version: '0' } })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBe('Bearer realm="curlycloud.dev"')
    expect(body.error?.message).toContain('raj9dholakia@gmail.com')

    const { token } = await createApiKey(db(), 'Acme')
    const ok = await rpc('tools/list', {}, { authorization: `Bearer ${token}` })
    expect(ok.res.status).toBe(200)
  })

  it('a valid key works, is attributed, and counts against its own daily limit', async () => {
    const { token, record } = await createApiKey(db(), 'Acme', 2)
    const auth = { authorization: `Bearer ${token}` }
    expect((await callTool('ask_raj', { question: 'one' }, auth)).isError).toBeUndefined()
    expect(h.answer).toHaveBeenCalledWith(h.env, expect.objectContaining({ clientId: `key:${record.id}`, keyId: record.id }))
    expect(rateRows()).toEqual([{ bucket: `mcp:k:${record.id}`, count: 1 }])

    expect((await callTool('get_profile', {}, auth)).isError).toBeUndefined()
    expect((await callTool('ask_raj', { question: 'two' }, auth)).isError).toBeUndefined()
    const limited = await callTool('ask_raj', { question: 'three' }, auth)
    expect(limited.isError).toBe(true)
    expect(text(limited)).toContain('this API key allows 2')

    const row = db().sqlite.prepare('SELECT use_count, last_used_at FROM api_keys WHERE id = ?').get(record.id) as any
    expect(row.use_count).toBe(4)
    expect(row.last_used_at).toBeGreaterThan(0)
    // Anonymous callers from the same IP are unaffected.
    expect((await callTool('ask_raj', { question: 'anon' })).isError).toBeUndefined()
  })
})

// ── HTTP ─────────────────────────────────────────────────────────────────────

describe('HTTP handling', () => {
  it('answers CORS preflight', async () => {
    const res = OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    const allowed = res.headers.get('access-control-allow-headers') ?? ''
    for (const hdr of ['authorization', 'content-type', 'mcp-protocol-version', 'mcp-session-id']) expect(allowed).toContain(hdr)
  })

  it('returns 405 for GET and DELETE in stateless mode', async () => {
    for (const res of [GET(), DELETE()]) {
      expect(res.status).toBe(405)
      expect(res.headers.get('allow')).toBe('POST, OPTIONS')
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(((await res.json()) as any).error.code).toBe(-32000)
    }
  })

  it('caps the body at 64 KB, by header and by actual size', async () => {
    const big = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ask_raj', arguments: { question: 'x'.repeat(70_000) } } })
    const byHeader = await POST(request(big, { 'content-length': String(big.length) }))
    expect(byHeader.status).toBe(413)
    const bySize = await POST(request(big))
    expect(bySize.status).toBe(413)
    expect(h.answer).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with a JSON-RPC parse error', async () => {
    const res = await POST(request('{not json'))
    expect(res.status).toBe(400)
    expect(((await res.json()) as any).error.code).toBe(-32700)
  })
})

// ── Real SDK client ──────────────────────────────────────────────────────────

describe('SDK Client compatibility', () => {
  // Route the client's fetches straight into the handlers.
  const routeFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(url, init)
    if (req.method === 'POST') return POST(req)
    if (req.method === 'GET') return GET()
    if (req.method === 'DELETE') return DELETE()
    return OPTIONS()
  }

  async function connect(headers: Record<string, string> = {}): Promise<Client> {
    const client = new Client({ name: 'test-agent', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(ENDPOINT), { fetch: routeFetch, requestInit: { headers } })
    await client.connect(transport)
    return client
  }

  it('connects, lists and calls tools, reads the resource and gets the prompt', async () => {
    const { token } = await createApiKey(db(), 'Acme')
    const client = await connect({ authorization: `Bearer ${token}` })
    expect(client.getServerVersion()?.name).toBe('raj-dholakia')
    expect(client.getInstructions()).toContain('AI clone')

    const { tools } = await client.listTools()
    expect(tools).toHaveLength(5)

    const profile = await client.callTool({ name: 'get_profile', arguments: {} })
    expect((profile.structuredContent as any).name).toBe('Raj Dholakia')

    // The client validates structuredContent against each outputSchema.
    const ask = await client.callTool({ name: 'ask_raj', arguments: { question: 'What did you build at Eddy?' } })
    expect(ask.isError).toBeFalsy()
    expect((ask.structuredContent as any).cited).toEqual([1, 2])
    const fit = await client.callTool({ name: 'assess_fit', arguments: { role_title: 'AI Engineer', job_description: 'MCP and RAG.' } })
    expect((fit.structuredContent as any).overall.verdict).toBe('promising')
    const topics = await client.callTool({ name: 'list_topics', arguments: {} })
    expect((topics.structuredContent as any).source).toBe('static')

    const resource = await client.readResource({ uri: RESUME_URI })
    expect((resource.contents[0] as any).text).toContain('# Raj Dholakia')
    const prompt = await client.getPrompt({ name: 'evaluate_candidate', arguments: { role_title: 'AI Engineer' } })
    expect((prompt.messages[0].content as any).text).toContain('No job description was provided')

    await client.close()
  })

  it('surfaces errors as tool results, not exceptions', async () => {
    h.answer.mockRejectedValue(new Error('not implemented'))
    const client = await connect()
    await client.listTools()
    const r = await client.callTool({ name: 'ask_raj', arguments: { question: 'Hello?' } })
    expect(r.isError).toBe(true)
    expect((r.content as any)[0].text).toMatch(/unavailable/)
    await client.close()
  })

  it('fails to connect with an invalid key', async () => {
    await expect(connect({ authorization: 'Bearer rc_wrong' })).rejects.toThrow(/401|Invalid or revoked/)
  })
})

// ── llms.txt ─────────────────────────────────────────────────────────────────

describe('/llms.txt', () => {
  it('describes Raj, the MCP endpoint, tools, limits and how to get a key', async () => {
    const res = await getLlmsTxt(new Request('https://curlycloud.dev/llms.txt'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    const body = await res.text()
    expect(body.startsWith('# Raj Dholakia')).toBe(true)
    expect(body).toContain('Endpoint: https://curlycloud.dev/mcp\n')
    expect(body).toContain('claude mcp add --transport http raj-dholakia https://curlycloud.dev/mcp')
    expect(body).toContain('--header "Authorization: Bearer rc_YOUR_KEY"')
    expect(body).toContain('"mcpServers"')
    expect(body).toContain('"method":"initialize"')
    for (const tool of ['get_profile', 'get_resume', 'list_topics', 'ask_raj', 'assess_fit', 'evaluate_candidate', RESUME_URI]) {
      expect(body).toContain(tool)
    }
    expect(body).toContain('AI clone')
    expect(body).toContain('Anonymous: 40 ask_raj/assess_fit calls per day')
    expect(body).toContain('raj9dholakia@gmail.com')
  })

  it('uses the request origin and points at production', async () => {
    const body = await (await getLlmsTxt(new Request('http://localhost:3202/llms.txt'))).text()
    expect(body).toContain('Endpoint: http://localhost:3202/mcp (production: https://curlycloud.dev/mcp)')
  })
})
