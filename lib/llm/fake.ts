/**
 * Deterministic stand-in for the Workers AI binding, for unit tests (never imported by app code).
 *
 * - Embeddings: feature-hashed bag of words (1024-d, L2-normalised), so texts sharing words are close.
 * - Rerank: word-overlap score.
 * - Chat: a scripted reply streamed as SSE in either frame shape Workers AI uses.
 * - JSON mode: a scripted object (or whatever `json` returns).
 */
import type { AiRunner } from '@/lib/llm/workers-ai'

export const FAKE_DIM = 1024

export interface FakeChatInput {
  messages: { role: string; content: string }[]
  stream?: boolean
  response_format?: unknown
}

export interface FakeAiOptions {
  /** Reply text, or a function of the request. Arrays are streamed chunk by chunk. */
  chat?: string | string[] | ((input: FakeChatInput) => string | string[])
  /** Frame shape used when streaming. */
  frames?: 'response' | 'openai'
  /** JSON-mode reply (object or raw string), or a function of the request and attempt number. */
  json?: unknown | ((input: FakeChatInput, attempt: number) => unknown)
  /** Throw on embedding calls (simulates Workers AI being down). */
  failEmbeddings?: boolean
  failRerank?: boolean
  /** Delay before rerank answers, to exercise timeouts. */
  rerankDelayMs?: number
  /** Usage reported in the final stream frame. `null` omits usage entirely. */
  usage?: { prompt_tokens: number; completion_tokens: number } | null
}

export interface FakeAi extends AiRunner {
  calls: { model: string; inputs: Record<string, unknown> }[]
  count(kind: 'embed' | 'rerank' | 'chat'): number
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []
}

function hash(word: string): number {
  let h = 2166136261
  for (let i = 0; i < word.length; i++) {
    h ^= word.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function fakeEmbedding(text: string, dim = FAKE_DIM): number[] {
  const v = new Array<number>(dim).fill(0)
  for (const w of tokenize(text)) {
    const h = hash(w)
    v[h % dim] += h & 0x80000000 ? -1 : 1
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map((x) => x / norm)
}

function sse(frames: unknown[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const payload = frames.map((f) => `data: ${typeof f === 'string' ? f : JSON.stringify(f)}\n\n`)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      // Split mid-frame on purpose so parsers must buffer.
      for (const p of payload) {
        const mid = Math.floor(p.length / 2)
        controller.enqueue(enc.encode(p.slice(0, mid)))
        controller.enqueue(enc.encode(p.slice(mid)))
      }
      controller.close()
    },
  })
}

export function createFakeAi(options: FakeAiOptions = {}): FakeAi {
  const calls: { model: string; inputs: Record<string, unknown> }[] = []
  let jsonAttempt = 0
  const kindOf = (model: string, inputs: Record<string, unknown>): 'embed' | 'rerank' | 'chat' =>
    'text' in inputs ? 'embed' : 'contexts' in inputs ? 'rerank' : (void model, 'chat')

  const ai: FakeAi = {
    calls,
    count: (kind) => calls.filter((c) => kindOf(c.model, c.inputs) === kind).length,
    async run(model: string, inputs: Record<string, unknown>): Promise<unknown> {
      calls.push({ model, inputs })
      const kind = kindOf(model, inputs)
      if (kind === 'embed') {
        if (options.failEmbeddings) throw new Error('fake embeddings unavailable')
        const texts = inputs.text as string[]
        return { shape: [texts.length, FAKE_DIM], data: texts.map((t) => fakeEmbedding(t)) }
      }
      if (kind === 'rerank') {
        if (options.failRerank) throw new Error('fake rerank unavailable')
        if (options.rerankDelayMs) await new Promise((r) => setTimeout(r, options.rerankDelayMs))
        const q = new Set(tokenize(inputs.query as string))
        const contexts = inputs.contexts as { text: string }[]
        const scored = contexts.map((c, id) => ({ id, score: tokenize(c.text).filter((w) => q.has(w)).length / 10 }))
        scored.sort((a, b) => b.score - a.score)
        return { response: scored.slice(0, Number(inputs.top_k ?? scored.length)) }
      }
      const input = inputs as unknown as FakeChatInput
      if (input.response_format) {
        const attempt = jsonAttempt++
        const reply = typeof options.json === 'function' ? (options.json as (i: FakeChatInput, a: number) => unknown)(input, attempt) : options.json
        return { response: reply ?? {}, usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } }
      }
      const reply = typeof options.chat === 'function' ? options.chat(input) : (options.chat ?? 'I built the work tracker at Eddy [1].')
      const chunks = Array.isArray(reply) ? reply : chunkWords(reply)
      const usage = options.usage === undefined ? { prompt_tokens: 120, completion_tokens: 30 } : options.usage
      if (!input.stream) {
        return { response: chunks.join(''), ...(usage ? { usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens } } : {}) }
      }
      const frames: unknown[] =
        options.frames === 'openai'
          ? chunks.map((c) => ({ choices: [{ delta: { content: c }, finish_reason: null, index: 0 }], usage: { prompt_tokens: 0, completion_tokens: 1 } }))
          : chunks.map((c) => ({ response: c, p: 'x' }))
      if (options.frames === 'openai') frames.push({ choices: [{ delta: {}, finish_reason: 'stop', index: 0 }] })
      if (usage) frames.push({ response: '', usage: { ...usage, total_tokens: usage.prompt_tokens + usage.completion_tokens } })
      frames.push('[DONE]')
      return sse(frames)
    },
  }
  return ai
}

/** Split text into word-ish chunks the way a model streams tokens. */
export function chunkWords(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [text]
}
