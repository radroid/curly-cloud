/**
 * The clone's answer loop. Yields `sources` once, then `delta`s, then `done` (or `error`).
 *
 *   budget check → hybrid retrieval → numbered sources → prompt → LLM stream
 *   → citation filter (drops out-of-range markers) → verbatim guard → holdback buffer → client
 *   → usage + chat_logs row → done
 */
import { getMeta, newId, now, run } from '@/lib/db'
import { getLimits, type AppEnv } from '@/lib/env'
import { estimateTokens, getLlm, systemText, type Llm, type LlmStopReason, type LlmUsage } from '@/lib/llm'
import { createCitationFilter } from '@/lib/rag/citations'
import { buildContext, type ContextSource } from '@/lib/rag/context'
import { createVerbatimGuard } from '@/lib/rag/guard'
import { buildMessages, buildSystemPrompt, PUBLIC_EMAIL, unknownLine } from '@/lib/rag/prompt'
import { retrievalQuery, retrieveChunks, type RetrieveOptions } from '@/lib/rag/retrieve'
import type { Answer, AnswerErrorCode, AnswerEvent, AnswerRequest, Channel, CitationSource } from '@/lib/rag/types'
import { budgetRemaining, recordUsage, redactPii } from '@/lib/security'

export class RagError extends Error {
  constructor(
    public code: AnswerErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'RagError'
  }
}

/** Chars held back from the client so the guard can stop a verbatim run before it's shown. */
export const HOLDBACK_CHARS = 48

const MAX_TOKENS: Record<Channel, number> = { web: 700, terminal: 700, mcp: 900, studio: 900 }

export const GUARD_LINE =
  "— actually, I'll stop there rather than recite my notes word for word. Ask me about a specific part and I'll put it in my own words."
export const REFUSAL_LINE = `That's not something I can help with here. Ask me about my work, or email me at ${PUBLIC_EMAIL}.`
export const BUDGET_MESSAGE = `I've answered as many questions as I can for today. Try again tomorrow, or email me at ${PUBLIC_EMAIL}.`
export const UNAVAILABLE_MESSAGE = 'The clone is unavailable right now. Try again in a minute.'

export interface AnswerInternals {
  /** Override the provider (tests). */
  llm?: Llm
  /** Write a chat_logs row (default true). Evals turn this off. */
  log?: boolean
  retrieve?: RetrieveOptions
}

export async function getPersonaText(db: D1Database): Promise<string | null> {
  const text = await getMeta(db, 'persona')
  return text?.trim() ? text : null
}

export interface LogEntry {
  channel: Channel
  kind: 'ask' | 'fit'
  clientId: string
  keyId: string | null
  question: string
  answer: string
  citations: unknown[]
  retrieved: string[]
  provider: string
  model: string
  usage: LlmUsage
  latencyMs: number
  guarded: boolean
}

/** Insert a chat_logs row. The question is PII-redacted here. Returns the row id, or null on failure. */
export async function writeLog(db: D1Database, e: LogEntry): Promise<string | null> {
  const id = newId('log_')
  try {
    await run(
      db,
      `INSERT INTO chat_logs (id, channel, kind, client_id, key_id, question, answer, citations, retrieved, provider, model,
         tokens_in, tokens_out, latency_ms, guarded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      e.channel,
      e.kind,
      e.clientId.slice(0, 120),
      e.keyId,
      redactPii(e.question).slice(0, 12_000),
      e.answer.slice(0, 20_000),
      JSON.stringify(e.citations),
      JSON.stringify(e.retrieved),
      e.provider,
      e.model,
      Math.round(e.usage.tokensIn),
      Math.round(e.usage.tokensOut),
      Math.round(e.latencyMs),
      e.guarded ? 1 : 0,
      now(),
    )
    return id
  } catch (err) {
    console.error('chat log write failed', err)
    return null
  }
}

/** Private text in the prompt that answers must not reproduce, and public text that's fine to quote. */
export function guardTexts(context: ContextSource[], persona: string | null): { protectedTexts: string[]; allowTexts: string[] } {
  const protectedTexts = context.filter((c) => c.visibility === 'private').map((c) => c.text)
  if (persona) protectedTexts.push(persona)
  return { protectedTexts, allowTexts: context.filter((c) => c.visibility === 'public').map((c) => c.text) }
}

export async function* runAnswer(env: AppEnv, req: AnswerRequest, internals: AnswerInternals = {}): AsyncGenerator<AnswerEvent> {
  const started = Date.now()
  const turns = (req.messages ?? []).filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
  const last = turns[turns.length - 1]
  if (!last || last.role !== 'user' || !last.content.trim()) {
    yield { type: 'error', code: 'bad_request', message: 'The last message must be a question from the user.' }
    return
  }

  const limits = getLimits(env)
  if ((await budgetRemaining(env.DB, limits.dailyTokenBudget)) <= 0) {
    yield { type: 'error', code: 'budget_exceeded', message: BUDGET_MESSAGE }
    return
  }

  let context: ContextSource[]
  let persona: string | null
  try {
    const [chunks, p] = await Promise.all([
      retrieveChunks(env, retrievalQuery(turns), { k: 8, ...internals.retrieve }),
      getPersonaText(env.DB),
    ])
    context = buildContext(chunks)
    persona = p
  } catch (err) {
    console.error('retrieval failed', err)
    yield { type: 'error', code: 'unavailable', message: UNAVAILABLE_MESSAGE }
    return
  }
  const sources: CitationSource[] = context.map((c) => c.citation)
  yield { type: 'sources', sources }

  const llm = internals.llm ?? getLlm(env)
  const system = buildSystemPrompt(persona)
  const messages = buildMessages(turns, context, req.channel)
  const { protectedTexts, allowTexts } = guardTexts(context, persona)
  const guard = createVerbatimGuard(protectedTexts, { allowTexts })
  const citations = createCitationFilter(sources.length)
  const controller = new AbortController()

  let emitted = ''
  let pending = ''
  let guarded = false
  let usage: LlmUsage | null = null
  let stopReason: LlmStopReason = 'end'
  let model = llm.model
  let failure: unknown = null

  const release = (): string => {
    if (pending.length <= HOLDBACK_CHARS) return ''
    const out = pending.slice(0, pending.length - HOLDBACK_CHARS)
    pending = pending.slice(out.length)
    return out
  }

  try {
    for await (const ev of llm.streamText({ system, messages, maxTokens: MAX_TOKENS[req.channel] ?? 700, signal: controller.signal })) {
      if (ev.type === 'done') {
        usage = ev.usage
        stopReason = ev.stopReason
        model = ev.model
        break
      }
      const clean = citations.push(ev.text)
      if (!clean) continue
      pending += clean
      if (guard.push(clean)) {
        guarded = true
        controller.abort()
        break
      }
      const out = release()
      if (out) {
        emitted += out
        yield { type: 'delta', text: out }
      }
    }
  } catch (err) {
    failure = err
  }

  if (!guarded) {
    const tail = citations.flush()
    pending += tail
    if ((tail && guard.push(tail)) || guard.finish()) guarded = true
  }

  let closing = ''
  if (guarded) closing = GUARD_LINE
  else if (stopReason === 'refusal') closing = REFUSAL_LINE
  else if (failure && !emitted && !pending.trim()) {
    console.error('generation failed', failure)
    yield { type: 'error', code: 'unavailable', message: UNAVAILABLE_MESSAGE }
    return
  } else if (!emitted.trim() && !pending.trim()) closing = unknownLine()

  if (closing) {
    // Held-back text is discarded: it may be the start of a verbatim run or a declined answer.
    pending = ''
    const text = emitted && !/\s$/.test(emitted) ? ` ${closing}` : closing
    emitted += text
    yield { type: 'delta', text }
  } else if (pending) {
    emitted += pending
    yield { type: 'delta', text: pending }
    pending = ''
  }

  const finalUsage: LlmUsage = usage ?? {
    tokensIn: estimateTokens(systemText(system) + messages.map((m) => m.content).join('\n')),
    tokensOut: estimateTokens(emitted),
  }
  try {
    await recordUsage(env.DB, finalUsage.tokensIn, finalUsage.tokensOut)
  } catch (err) {
    console.error('usage record failed', err)
  }

  const cited = citations.cited()
  const latencyMs = Date.now() - started
  const logId =
    internals.log === false
      ? null
      : await writeLog(env.DB, {
          channel: req.channel,
          kind: 'ask',
          clientId: req.clientId,
          keyId: req.keyId ?? null,
          question: last.content,
          answer: emitted,
          citations: sources.filter((s) => cited.includes(s.n)),
          retrieved: sources.map((s) => s.id),
          provider: llm.provider,
          model,
          usage: finalUsage,
          latencyMs,
          guarded,
        })

  if (failure) {
    console.error('generation failed mid-answer', failure)
    yield { type: 'error', code: 'unavailable', message: 'The answer was cut short. Try asking again.' }
    return
  }
  yield { type: 'done', cited, provider: llm.provider, model, latencyMs, guarded, logId }
}

/** Collect a full answer (MCP, evals). Throws RagError on an `error` event. */
export async function collectAnswer(env: AppEnv, req: AnswerRequest, internals: AnswerInternals = {}): Promise<Answer> {
  let text = ''
  let sources: CitationSource[] = []
  for await (const ev of runAnswer(env, req, internals)) {
    if (ev.type === 'sources') sources = ev.sources
    else if (ev.type === 'delta') text += ev.text
    else if (ev.type === 'error') throw new RagError(ev.code, ev.message)
    else if (ev.type === 'done') {
      return {
        text,
        sources,
        cited: ev.cited,
        provider: ev.provider,
        model: ev.model,
        latencyMs: ev.latencyMs,
        guarded: ev.guarded,
        logId: ev.logId,
      }
    }
  }
  throw new RagError('internal', 'The answer stream ended without finishing.')
}
