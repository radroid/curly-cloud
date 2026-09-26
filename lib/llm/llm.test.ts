import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { FALLBACK_BETA, createAnthropicLlm, type AnthropicClientLike } from '@/lib/llm/anthropic'
import { createFakeAi } from '@/lib/llm/fake'
import { getLlm, LlmError, type LlmStreamEvent } from '@/lib/llm'
import { createWorkersAiLlm, embedTexts, parseWorkersAiFrame, parseWorkersAiSse, rerankTexts } from '@/lib/llm/workers-ai'

function streamOf(parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p))
      c.close()
    },
  })
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of gen) out.push(x)
  return out
}

describe('Workers AI stream parsing', () => {
  it('reads {"response"} frames, a usage frame and [DONE]', async () => {
    const frames = await collect(
      parseWorkersAiSse(
        streamOf([
          'data: {"response":"Hel","p":"x"}\n\ndata: {"respon',
          'se":"lo"}\r\n\r\n',
          'data: {"response":"","usage":{"prompt_tokens":21,"completion_tokens":14,"total_tokens":35}}\n\n',
          'data: [DONE]\n\n',
          'data: {"response":"after done"}\n\n',
        ]),
      ),
    )
    expect(frames.map((f) => f.text ?? '')).toEqual(['Hel', 'lo', ''])
    expect(frames[2].usage).toEqual({ tokensIn: 21, tokensOut: 14 })
    expect(frames[2].usageIsTotal).toBe(true)
  })

  it('reads OpenAI-style choices[0].delta.content frames with per-chunk usage', () => {
    const f = parseWorkersAiFrame('{"choices":[{"delta":{"content":"Hi"},"finish_reason":null}],"usage":{"prompt_tokens":0,"completion_tokens":1}}')
    expect(f).toEqual({ text: 'Hi', usage: { tokensIn: 0, tokensOut: 1 }, usageIsTotal: false })
    expect(parseWorkersAiFrame('{"choices":[{"delta":{},"finish_reason":"length"}]}')).toEqual({ finishReason: 'length' })
    expect(parseWorkersAiFrame('[DONE]')).toBe('done')
    expect(parseWorkersAiFrame('not json')).toBeNull()
    // Real frames carry both shapes; `response` wins so text isn't doubled.
    expect(parseWorkersAiFrame('{"response":"A","choices":[{"delta":{"content":"A"}}]}')).toMatchObject({ text: 'A' })
  })

  it.each(['response', 'openai'] as const)('streams text and usage end to end (%s frames)', async (frames) => {
    const ai = createFakeAi({ chat: ['Hello', ' there'], frames, usage: { prompt_tokens: 50, completion_tokens: 2 } })
    const llm = createWorkersAiLlm({ ai, model: 'm' })
    const events = await collect(llm.streamText({ system: 's', messages: [{ role: 'user', content: 'q' }] }))
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('')).toBe('Hello there')
    const done = events[events.length - 1] as Extract<LlmStreamEvent, { type: 'done' }>
    expect(done).toMatchObject({ type: 'done', usage: { tokensIn: 50, tokensOut: 2 }, stopReason: 'end', model: 'm' })
  })

  it('estimates usage when the stream reports none', async () => {
    const llm = createWorkersAiLlm({ ai: createFakeAi({ chat: 'x'.repeat(40), usage: null }), model: 'm' })
    const events = await collect(llm.streamText({ system: 'y'.repeat(400), messages: [{ role: 'user', content: 'q' }] }))
    const done = events.at(-1) as Extract<LlmStreamEvent, { type: 'done' }>
    expect(done.usage?.tokensOut).toBe(10)
    expect(done.usage?.tokensIn).toBeGreaterThan(100)
  })
})

describe('Workers AI JSON mode', () => {
  const Schema = z.object({ score: z.number(), reason: z.string() })

  it('accepts an already-parsed object and a fenced string', async () => {
    const llm = createWorkersAiLlm({ ai: createFakeAi({ json: { score: 4, reason: 'ok' } }), model: 'm' })
    expect((await llm.generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] })).data).toEqual({ score: 4, reason: 'ok' })
    const llm2 = createWorkersAiLlm({ ai: createFakeAi({ json: 'Sure!\n```json\n{"score": 2, "reason": "meh"}\n```' }), model: 'm' })
    expect((await llm2.generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] })).data.score).toBe(2)
  })

  it('sends a json_schema response_format and repairs once', async () => {
    const ai = createFakeAi({ json: (_i: unknown, attempt: number) => (attempt === 0 ? { score: 'high' } : { score: 5, reason: 'fixed' }) })
    const llm = createWorkersAiLlm({ ai, model: 'm' })
    const res = await llm.generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] })
    expect(res.data).toEqual({ score: 5, reason: 'fixed' })
    expect(ai.calls).toHaveLength(2)
    const format = ai.calls[0].inputs.response_format as { type: string; json_schema: { properties: Record<string, unknown> } }
    expect(format.type).toBe('json_schema')
    expect(Object.keys(format.json_schema.properties)).toEqual(['score', 'reason'])
    const repair = ai.calls[1].inputs.messages as { role: string; content: string }[]
    expect(repair.at(-1)?.content).toMatch(/did not match the required JSON schema/)
  })

  it('gives up after one repair', async () => {
    const llm = createWorkersAiLlm({ ai: createFakeAi({ json: 'nope' }), model: 'm' })
    await expect(llm.generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] })).rejects.toBeInstanceOf(LlmError)
  })
})

describe('embeddings and rerank', () => {
  it('batches embedding calls', async () => {
    const ai = createFakeAi()
    const texts = Array.from({ length: 120 }, (_, i) => `text ${i}`)
    const vectors = await embedTexts(ai, 'emb', texts)
    expect(vectors).toHaveLength(120)
    expect(vectors[0]).toHaveLength(1024)
    expect(ai.count('embed')).toBe(3)
  })

  it('returns rerank scores best first', async () => {
    const ranked = await rerankTexts(createFakeAi(), 'rr', 'eddy tracker', ['hiking', 'tracker at eddy', 'eddy'])
    expect(ranked[0].index).toBe(1)
  })
})

// ── Anthropic (mocked client) ────────────────────────────────────────────────

type Params = Record<string, unknown>

function mockAnthropic(opts: { text?: string[]; stopReason?: string; parsed?: unknown; model?: string } = {}) {
  const calls: { method: string; params: Params; options: unknown }[] = []
  const usage = { input_tokens: 100, cache_creation_input_tokens: 20, cache_read_input_tokens: 500, output_tokens: 42 }
  const message = (content: unknown[]) => ({
    id: 'msg_1',
    model: opts.model ?? 'claude-opus-5',
    stop_reason: opts.stopReason ?? 'end_turn',
    content,
    usage,
  })
  const client = {
    beta: {
      messages: {
        stream(params: Params, options: unknown) {
          calls.push({ method: 'stream', params, options })
          const text = opts.text ?? ['Hi ', 'there']
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: 'message_start', message: message([]) }
              yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }
              for (const t of text) yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }
              yield { type: 'message_stop' }
            },
            finalMessage: async () => message([{ type: 'text', text: text.join('') }]),
          }
        },
        async parse(params: Params, options: unknown) {
          calls.push({ method: 'parse', params, options })
          return { ...message([{ type: 'text', text: JSON.stringify(opts.parsed ?? {}) }]), parsed_output: opts.parsed ?? null }
        },
      },
    },
  }
  return { client: client as unknown as AnthropicClientLike, calls }
}

describe('Anthropic provider', () => {
  it('streams text, caches the stable system prefix and opts into refusal fallbacks', async () => {
    const { client, calls } = mockAnthropic()
    const llm = createAnthropicLlm({ model: 'claude-opus-5', client })
    const events = await collect(llm.streamText({ system: { stable: 'IDENTITY', dynamic: 'EXTRA' }, messages: [{ role: 'user', content: 'q' }], maxTokens: 300 }))
    expect(events.slice(0, 2)).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'text', text: 'there' },
    ])
    expect(events[2]).toEqual({ type: 'done', usage: { tokensIn: 620, tokensOut: 42, cacheReadTokens: 500 }, stopReason: 'end', model: 'claude-opus-5' })
    const p = calls[0].params
    expect(p.model).toBe('claude-opus-5')
    expect(p.max_tokens).toBe(300)
    expect(p.system).toEqual([
      { type: 'text', text: 'IDENTITY', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'EXTRA' },
    ])
    expect(p.betas).toEqual([FALLBACK_BETA])
    expect(p.fallbacks).toBe('default')
    expect(p.thinking).toEqual({ type: 'disabled' })
    expect(p.output_config).toEqual({ effort: 'low' })
    expect(p).not.toHaveProperty('temperature')
  })

  it('reports a refusal stop reason and the fallback model that served the answer', async () => {
    const { client } = mockAnthropic({ stopReason: 'refusal', text: [] })
    const events = await collect(createAnthropicLlm({ model: 'claude-opus-5', client }).streamText({ system: 's', messages: [{ role: 'user', content: 'q' }] }))
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'refusal' })
    const served = mockAnthropic({ model: 'claude-opus-4-8' })
    const ev2 = await collect(createAnthropicLlm({ model: 'claude-opus-5', client: served.client }).streamText({ system: 's', messages: [{ role: 'user', content: 'q' }] }))
    expect(ev2.at(-1)).toMatchObject({ model: 'claude-opus-4-8' })
  })

  it('uses structured outputs with adaptive thinking for JSON', async () => {
    const Schema = z.object({ score: z.number() })
    const { client, calls } = mockAnthropic({ parsed: { score: 4 } })
    const res = await createAnthropicLlm({ model: 'claude-opus-5', client }).generateJson(Schema, {
      system: 'judge',
      messages: [{ role: 'user', content: 'q' }],
      thinking: true,
    })
    expect(res.data).toEqual({ score: 4 })
    const p = calls[0].params as { thinking: unknown; output_config: { effort: string; format: { type: string; schema: unknown } } }
    expect(calls[0].method).toBe('parse')
    expect(p.thinking).toEqual({ type: 'adaptive' })
    expect(p.output_config.effort).toBe('medium')
    expect(p.output_config.format.type).toBe('json_schema')
    expect(p.output_config.format.schema).toBeTruthy()
  })

  it('throws LlmError on refusal or invalid JSON', async () => {
    const Schema = z.object({ score: z.number() })
    const refused = mockAnthropic({ stopReason: 'refusal' })
    await expect(
      createAnthropicLlm({ model: 'claude-opus-5', client: refused.client }).generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] }),
    ).rejects.toMatchObject({ code: 'refusal' })
    const bad = mockAnthropic({ parsed: { score: 'x' } })
    await expect(
      createAnthropicLlm({ model: 'claude-opus-5', client: bad.client }).generateJson(Schema, { system: 's', messages: [{ role: 'user', content: 'q' }] }),
    ).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('getLlm picks Anthropic only when a key is set', () => {
    const env = { AI: createFakeAi(), ANTHROPIC_MODEL: 'claude-opus-5', WORKERS_AI_CHAT_MODEL: '@cf/meta/llama' }
    expect(getLlm(env as never).provider).toBe('workers-ai')
    expect(getLlm(env as never).model).toBe('@cf/meta/llama')
    const { client } = mockAnthropic()
    const llm = getLlm({ ...env, ANTHROPIC_API_KEY: 'sk-test' } as never, { anthropicClient: client })
    expect(llm.provider).toBe('anthropic')
    expect(llm.model).toBe('claude-opus-5')
  })
})
