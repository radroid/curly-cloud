/**
 * Workers AI: chat (streaming + JSON), embeddings and reranking through the `AI` binding.
 * Always remote, even in local dev, and billed per call.
 */
import type { z } from 'zod'
import { describeIssues, extractJson, jsonSchemaFor } from '@/lib/llm/json'
import {
  estimateTokens,
  LlmError,
  systemText,
  type Llm,
  type LlmCallOptions,
  type LlmJsonOptions,
  type LlmJsonResult,
  type LlmMessage,
  type LlmStopReason,
  type LlmStreamEvent,
  type LlmTextResult,
  type LlmUsage,
} from '@/lib/llm/types'

/** The slice of the `Ai` binding this module uses. Model ids come from vars, so they're plain strings. */
export interface AiRunner {
  run(model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>): Promise<unknown>
}

export function asAiRunner(ai: unknown): AiRunner {
  return ai as AiRunner
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function chatMessages(opts: LlmCallOptions): ChatMessage[] {
  return [{ role: 'system', content: systemText(opts.system) }, ...opts.messages.map((m) => ({ role: m.role, content: m.content }))]
}

function estimateUsage(messages: ChatMessage[], output: string): LlmUsage {
  return { tokensIn: estimateTokens(messages.map((m) => m.content).join('\n')), tokensOut: estimateTokens(output) }
}

function usageFrom(raw: unknown): LlmUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const u = raw as { prompt_tokens?: unknown; completion_tokens?: unknown; input_tokens?: unknown; output_tokens?: unknown }
  const tokensIn = Number(u.prompt_tokens ?? u.input_tokens)
  const tokensOut = Number(u.completion_tokens ?? u.output_tokens)
  if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut)) return null
  return { tokensIn, tokensOut }
}

// ── Stream parsing ───────────────────────────────────────────────────────────

/**
 * One decoded frame. Probed shape (llama-4-scout, 2026-09): every chunk carries both `response` and
 * OpenAI-style `choices[0].delta.content` plus a per-chunk *delta* `usage`; a final frame without
 * `choices` carries the *cumulative* usage, then `[DONE]`. Older models send `{"response":…}` only.
 */
export type WorkersAiFrame = { text?: string; usage?: LlmUsage; usageIsTotal?: boolean; finishReason?: string }

/** Decode one SSE `data:` payload. Handles `{"response":…}` and OpenAI-style `choices[0].delta.content`. */
export function parseWorkersAiFrame(data: string): WorkersAiFrame | 'done' | null {
  const trimmed = data.trim()
  if (!trimmed) return null
  if (trimmed === '[DONE]') return 'done'
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
  const frame: WorkersAiFrame = {}
  if (typeof obj.response === 'string') {
    frame.text = obj.response
  } else if (Array.isArray(obj.choices)) {
    const choice = obj.choices[0] as { delta?: { content?: unknown }; text?: unknown; finish_reason?: unknown } | undefined
    const content = choice?.delta?.content ?? choice?.text
    if (typeof content === 'string') frame.text = content
    if (typeof choice?.finish_reason === 'string') frame.finishReason = choice.finish_reason
  }
  if (typeof obj.finish_reason === 'string') frame.finishReason = obj.finish_reason
  const usage = usageFrom(obj.usage)
  if (usage) {
    frame.usage = usage
    frame.usageIsTotal = !Array.isArray(obj.choices)
  }
  return frame
}

/** Parse a Workers AI SSE byte stream into frames. Tolerates frames split across chunks and CRLF. */
export async function* parseWorkersAiSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<WorkersAiFrame> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const drain = function* (final: boolean): Generator<WorkersAiFrame | 'done'> {
    buffer = buffer.replace(/\r\n/g, '\n')
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1 || (final && buffer.trim())) {
      const raw = sep === -1 ? buffer : buffer.slice(0, sep)
      buffer = sep === -1 ? '' : buffer.slice(sep + 2)
      const data = raw
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n')
      const frame = parseWorkersAiFrame(data)
      if (frame) yield frame
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (const f of drain(false)) {
        if (f === 'done') return
        yield f
      }
    }
    buffer += decoder.decode()
    for (const f of drain(true)) {
      if (f === 'done') return
      yield f
    }
  } finally {
    reader.releaseLock()
  }
}

// ── Chat provider ────────────────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 1024
const TEMPERATURE = 0.3

function stopReason(finish: string | undefined, aborted: boolean): LlmStopReason {
  if (aborted) return 'aborted'
  if (finish === 'length' || finish === 'max_tokens') return 'max_tokens'
  return 'end'
}

export function createWorkersAiLlm(opts: { ai: AiRunner; model: string }): Llm {
  const { ai, model } = opts

  async function* streamText(call: LlmCallOptions): AsyncGenerator<LlmStreamEvent> {
    const messages = chatMessages(call)
    const result = await ai.run(model, {
      messages,
      stream: true,
      max_tokens: call.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: TEMPERATURE,
    })
    let output = ''
    let usage: LlmUsage | null = null
    let total: LlmUsage | null = null
    const summed: LlmUsage = { tokensIn: 0, tokensOut: 0 }
    let finish: string | undefined
    if (result instanceof ReadableStream) {
      const stream = result as ReadableStream<Uint8Array>
      const onAbort = (): void => void stream.cancel().catch(() => undefined)
      call.signal?.addEventListener('abort', onAbort, { once: true })
      try {
        for await (const frame of parseWorkersAiSse(stream)) {
          if (call.signal?.aborted) break
          if (frame.usage && frame.usageIsTotal) total = frame.usage
          else if (frame.usage) {
            summed.tokensIn += frame.usage.tokensIn
            summed.tokensOut += frame.usage.tokensOut
          }
          if (frame.finishReason) finish = frame.finishReason
          if (frame.text) {
            output += frame.text
            yield { type: 'text', text: frame.text }
          }
        }
      } catch (err) {
        if (!call.signal?.aborted) throw err
      } finally {
        call.signal?.removeEventListener('abort', onAbort)
      }
      usage = total ?? summed
    } else {
      // Some models ignore `stream` and answer in one piece.
      const text = responseText(result)
      output = text
      usage = usageFrom((result as { usage?: unknown })?.usage)
      if (text) yield { type: 'text', text }
    }
    // A zero-token usage frame is a placeholder, not a measurement.
    if (usage && usage.tokensIn + usage.tokensOut === 0) usage = null
    yield { type: 'done', usage: usage ?? estimateUsage(messages, output), stopReason: stopReason(finish, !!call.signal?.aborted), model }
  }

  async function generateText(call: LlmCallOptions): Promise<LlmTextResult> {
    const messages = chatMessages(call)
    const result = await ai.run(model, { messages, max_tokens: call.maxTokens ?? DEFAULT_MAX_TOKENS, temperature: TEMPERATURE })
    const text = responseText(result)
    const usage = usageFrom((result as { usage?: unknown })?.usage) ?? estimateUsage(messages, text)
    return { text, usage, stopReason: 'end', model }
  }

  async function generateJson<T>(schema: z.ZodType<T>, call: LlmJsonOptions): Promise<LlmJsonResult<T>> {
    const jsonSchema = jsonSchemaFor(schema)
    const messages = chatMessages(call)
    let usage: LlmUsage = { tokensIn: 0, tokensOut: 0 }
    let lastRaw: unknown
    let lastIssue = 'no JSON found'
    // One attempt plus one repair retry that shows the model what failed.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = (await ai.run(model, {
        messages,
        response_format: { type: 'json_schema', json_schema: jsonSchema },
        max_tokens: call.maxTokens ?? 2048,
        temperature: 0.2,
      })) as { response?: unknown; usage?: unknown }
      const raw = result?.response
      const u = usageFrom(result?.usage) ?? estimateUsage(messages, typeof raw === 'string' ? raw : JSON.stringify(raw ?? ''))
      usage = { tokensIn: usage.tokensIn + u.tokensIn, tokensOut: usage.tokensOut + u.tokensOut }
      lastRaw = raw
      const candidate = extractJson(raw)
      if (candidate !== undefined) {
        const parsed = schema.safeParse(candidate)
        if (parsed.success) return { data: parsed.data, usage, model }
        lastIssue = describeIssues(parsed.error)
      }
      const shown = typeof raw === 'string' ? raw : JSON.stringify(raw ?? null)
      messages.push(
        { role: 'assistant', content: shown.slice(0, 6000) },
        {
          role: 'user',
          content: `That output did not match the required JSON schema (${lastIssue}). Reply again with only the corrected JSON object.`,
        },
      )
    }
    throw new LlmError('invalid_output', `Workers AI returned JSON that failed validation: ${lastIssue}`, { cause: lastRaw })
  }

  return { provider: 'workers-ai', model, streamText, generateText, generateJson }
}

function responseText(result: unknown): string {
  if (typeof result === 'string') return result
  const r = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null
  if (typeof r?.response === 'string') return r.response
  if (r?.response && typeof r.response === 'object') return JSON.stringify(r.response)
  const content = r?.choices?.[0]?.message?.content
  return typeof content === 'string' ? content : ''
}

// ── Embeddings & rerank ──────────────────────────────────────────────────────

export const EMBEDDING_BATCH = 50

/** Embed texts in batches. Returns one vector per input, in order. */
export async function embedTexts(ai: AiRunner, model: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH)
    const res = (await ai.run(model, { text: batch })) as { data?: number[][] }
    if (!Array.isArray(res?.data) || res.data.length !== batch.length) {
      throw new Error(`Embedding model returned ${res?.data?.length ?? 0} vectors for ${batch.length} inputs`)
    }
    out.push(...res.data)
  }
  return out
}

/** Cross-encoder rerank. Returns `{ index, score }` sorted best first. */
export async function rerankTexts(
  ai: AiRunner,
  model: string,
  query: string,
  texts: string[],
  topK: number = texts.length,
): Promise<{ index: number; score: number }[]> {
  if (texts.length === 0) return []
  const res = (await ai.run(model, { query, contexts: texts.map((text) => ({ text })), top_k: topK })) as {
    response?: { id?: number; score?: number }[]
  }
  if (!Array.isArray(res?.response)) throw new Error('Rerank model returned no scores')
  return res.response
    .filter((r) => typeof r.id === 'number' && typeof r.score === 'number')
    .map((r) => ({ index: r.id as number, score: r.score as number }))
    .sort((a, b) => b.score - a.score)
}

export type { LlmMessage }
