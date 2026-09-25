import { describe, expect, it } from 'vitest'
import { getMeta } from '@/lib/db'
import { assessFit, getPersona, ingestSources, rebuildPersona, seedPublicSources } from '@/lib/rag'
import { finalizeFit, requirementQueries, type FitWire } from '@/lib/rag/fit'
import { minimalPersona, scrubPersona } from '@/lib/rag/persona'
import { createTestEnv, FAKE_PRIVATE } from '@/lib/rag/testing'
import type { FitRequest } from '@/lib/rag/types'

const JD = `About us: we build developer tools.
We offer great benefits, equity and unlimited PTO.

Requirements:
- 4+ years of experience building production LLM features (RAG, evals, agents)
- Strong TypeScript and Python
- Experience with MCP servers and tool-calling agents
- Familiarity with AWS or Cloudflare Workers
- Nice to have: Kubernetes operators written in Go`

const wire = (over: Partial<FitWire> = {}): FitWire => ({
  overall: { score: 9, verdict: 'weak', summary: 'Raj has shipped RAG and MCP work.' },
  technical: { score: 4.4, summary: 'Direct RAG and MCP evidence.', strengths: ['RAG', 'MCP'], gaps: ['Go'], evidence: [1, 2, 2, 99, 0] },
  culture: { score: -3, summary: 'Little evidence.', strengths: [], gaps: [], evidence: [] },
  questionsForRaj: ['Is this role remote?'],
  unknowns: ['Kubernetes operators in Go'],
  ...over,
})

const req = (over: Partial<FitRequest> = {}): FitRequest => ({
  roleTitle: 'Senior AI Engineer',
  jobDescription: JD,
  company: 'Acme',
  cultureNotes: 'Small team, writes things down',
  channel: 'web',
  clientId: 'c1',
  ...over,
})

describe('fit assessment', () => {
  it('pulls requirement-like lines from a JD and skips perks', () => {
    const qs = requirementQueries(JD)
    expect(qs).toContain('4+ years of experience building production LLM features (RAG, evals, agents)')
    expect(qs).toContain('Experience with MCP servers and tool-calling agents')
    expect(qs.some((q) => /benefits/i.test(q))).toBe(false)
    expect(qs.length).toBeLessThanOrEqual(6)
  })

  it('clamps scores, validates evidence and keeps the verdict consistent', () => {
    const ctx = [
      { citation: { n: 1, id: 'a', kind: 'resume', visibility: 'public', title: 'A', topic: null, anchor: null, snippet: 's' }, text: 'a', visibility: 'public' },
      { citation: { n: 2, id: 'b', kind: 'resume', visibility: 'public', title: 'B', topic: null, anchor: null, snippet: 's' }, text: 'b', visibility: 'public' },
    ] as Parameters<typeof finalizeFit>[2]
    const out = finalizeFit(wire(), { roleTitle: 'X', company: ' ' }, ctx)
    expect(out.overall).toMatchObject({ score: 5, verdict: 'strong' })
    expect(out.technical).toMatchObject({ score: 4, evidence: [1, 2] })
    expect(out.culture.score).toBe(1)
    expect(out.company).toBeNull()
    expect(out.sources.map((s) => s.n)).toEqual([1, 2])
  })

  it('withholds any field that copies private text', () => {
    const priv = FAKE_PRIVATE[0].body
    const ctx = [
      { citation: { n: 1, id: 'p', kind: 'interview', visibility: 'private', title: 'Q', topic: null, anchor: null, snippet: null }, text: priv, visibility: 'private' },
    ] as Parameters<typeof finalizeFit>[2]
    const out = finalizeFit(wire({ overall: { score: 3, verdict: 'mixed', summary: priv } }), { roleTitle: 'X' }, ctx)
    expect(out.overall.summary).toBe('(withheld: ask Raj directly)')
  })

  it('runs end to end: retrieval over several queries, JSON, clamping and a fit log row', async () => {
    const env = createTestEnv({ json: wire() })
    await seedPublicSources(env)
    await ingestSources(env, FAKE_PRIVATE)
    const out = await assessFit(env, req())
    expect(out.provider).toBe('workers-ai')
    expect(out.sources.length).toBeGreaterThan(0)
    expect(out.sources.length).toBeLessThanOrEqual(16)
    expect(out.sources.filter((s) => s.visibility === 'private').every((s) => s.snippet === null)).toBe(true)
    expect(out.technical.evidence.every((n) => n >= 1 && n <= out.sources.length)).toBe(true)
    expect(out.overall.score).toBe(5)
    expect(env.AI.count('embed')).toBeGreaterThan(0)
    // All queries embedded in one call (after the ingest calls).
    const lastEmbed = env.AI.calls.filter((c) => 'text' in c.inputs).at(-1)!
    expect((lastEmbed.inputs.text as string[]).length).toBeGreaterThan(3)
    const row = (await env.DB.prepare("SELECT * FROM chat_logs WHERE kind = 'fit'").first()) as Record<string, unknown>
    expect(row.id).toBe(out.logId)
    expect(row.question).toMatch(/^Fit: Senior AI Engineer at Acme/)
  })

  it('throws budget_exceeded and unavailable as RagErrors', async () => {
    const env = createTestEnv({ json: 'not json at all' }, { DAILY_TOKEN_BUDGET: '1' })
    await expect(assessFit(env, req())).rejects.toMatchObject({ code: 'unavailable' })
    await env.DB.prepare("INSERT INTO usage_daily (day, requests, tokens_in, tokens_out) VALUES (date('now'), 1, 5, 5)").run()
    await expect(assessFit(env, req())).rejects.toMatchObject({ code: 'budget_exceeded' })
  })
})

describe('persona', () => {
  it('writes a minimal persona from the resume when there are no private sources', async () => {
    const env = createTestEnv()
    await seedPublicSources(env)
    const res = await rebuildPersona(env)
    expect(res).toEqual({ text: minimalPersona(), sourcesUsed: 0 })
    expect(env.AI.count('chat')).toBe(0)
    const stored = await getPersona(env)
    expect(stored?.text).toBe(minimalPersona())
    expect(stored?.updatedAt).toBeGreaterThan(0)
  })

  it('distils private answers with the LLM and drops copied lines', async () => {
    const copied = FAKE_PRIVATE[1].body
    const env = createTestEnv({
      chat: (input) => {
        expect(input.messages[1].content).toContain('<answer kind="interview" topic="Engineering taste"')
        return `Voice & phrasing habits\n- Plain, direct.\n- ${copied}\nCore principles\n- Write it down first.`
      },
    })
    await ingestSources(env, FAKE_PRIVATE)
    const res = await rebuildPersona(env)
    expect(res.sourcesUsed).toBe(2)
    expect(res.text).toContain('Write it down first.')
    expect(res.text).not.toContain('long blocks of focus time')
    expect(await getMeta(env.DB, 'persona')).toBe(res.text)
  })

  it('scrubs lines that reproduce ten or more private words', () => {
    const text = 'keep this line\n- I do my best work in small teams that write things down, argue\n- paraphrased: small teams, written trade-offs'
    expect(scrubPersona(text, [FAKE_PRIVATE[1].body])).toBe('keep this line\n- paraphrased: small teams, written trade-offs')
  })
})
