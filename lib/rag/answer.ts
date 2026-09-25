/**
 * The clone's answer loop. Yields `sources` once, then `delta`s, then `done` (or `error`).
 *
 *   budget check → hybrid retrieval → numbered sources → prompt → LLM stream
 *   → citation filter (drops out-of-range markers) → verbatim guard → word holdback → client
 *   → usage + chat_logs row → done
 */
import { resumeSources } from '@/content/resume'
import { getMeta, newId, now, run } from '@/lib/db'
import { getLimits, type AppEnv } from '@/lib/env'
import { estimateTokens, getLlm, systemText, type Llm, type LlmStopReason, type LlmUsage } from '@/lib/llm'
import { createCitationFilter } from '@/lib/rag/citations'
import { buildContext, type ContextSource } from '@/lib/rag/context'
import { buildGuardIndex, createVerbatimGuard, DEFAULT_GUARD_WINDOW, LETTER_HOLDBACK, PROMPT_MARKERS, releasableIndex } from '@/lib/rag/guard'
import { EXTRACTION_REPLY, isPromptExtraction } from '@/lib/rag/injection'
import { buildMessages, buildSystemPrompt, PUBLIC_EMAIL, sayableLines, unknownLine } from '@/lib/rag/prompt'
import { retrievalQuery, retrieveChunks, type RetrieveOptions } from '@/lib/rag/retrieve'
import { signTurn, trustedTurns, turnSecret } from '@/lib/rag/turns'
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

/**
 * Held back from the client: at least the verbatim window in words and the letters window in
 * letters (the guard only counts a word once it's complete, so it can lag the buffer by one word;
 * holding back both windows means no part of a run those checks detect has been shown yet), and
 * never anything from the start of a live alignment on (`guard.holdFrom()`).
 */
export const HOLDBACK_WORDS = DEFAULT_GUARD_WINDOW
export const HOLDBACK_LETTERS = LETTER_HOLDBACK

const MAX_TOKENS: Record<Channel, number> = { web: 700, terminal: 700, mcp: 900, studio: 900 }

export const GUARD_LINE =
  "— actually, I'll stop there rather than recite my notes word for word. Ask me about a specific part and I'll put it in my own words."
export const GUARD_LINE_FRESH =
  "I'd rather not recite my notes or instructions word for word. Ask me about a specific part and I'll put it in my own words."
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

let publicTexts: string[] | null = null

/** The public resume, which may be quoted verbatim (the minimal persona quotes it too). */
export function publicResumeTexts(): string[] {
  publicTexts ??= resumeSources().map((s) => s.body)
  return publicTexts
}

/**
 * Text answers must not reproduce (private sources, and the system prompt with the persona) and
 * text that's fine to say verbatim (public sources, the public resume, the clone's stock lines).
 */
export function guardTexts(context: ContextSource[], systemPrompt: string): { protectedTexts: string[]; allowTexts: string[] } {
  const protectedTexts = [...context.filter((c) => c.visibility === 'private').map((c) => c.text), systemPrompt]
  const allowTexts = [...context.filter((c) => c.visibility === 'public').map((c) => c.text), ...publicResumeTexts(), ...sayableLines()]
  return { protectedTexts, allowTexts }
}

export async function* runAnswer(env: AppEnv, req: AnswerRequest, internals: AnswerInternals = {}): AsyncGenerator<AnswerEvent> {
  const started = Date.now()
  const received = (req.messages ?? []).filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
  const last = received[received.length - 1]
  if (!last || last.role !== 'user' || !last.content.trim()) {
    yield { type: 'error', code: 'bad_request', message: 'The last message must be a question from the user.' }
    return
  }

  const limits = getLimits(env)
  if ((await budgetRemaining(env.DB, limits.dailyTokenBudget)) <= 0) {
    yield { type: 'error', code: 'budget_exceeded', message: BUDGET_MESSAGE }
    return
  }

  // Replayed assistant turns count only if we signed them; the rest never reach the model.
  const secret = turnSecret(env)
  const turns = await trustedTurns(secret, received)
  const sign = async (text: string): Promise<{ sig?: string }> => (secret ? { sig: await signTurn(secret, text) } : {})

  // Prompt-extraction requests in any user turn (an earlier one, or MCP context) get a fixed reply
  // without a model call. `guarded` marks it.
  const extraction = turns.find((t) => t.role === 'user' && isPromptExtraction(t.content))
  if (extraction) {
    const llm = internals.llm ?? getLlm(env)
    yield { type: 'sources', sources: [] }
    yield { type: 'delta', text: EXTRACTION_REPLY }
    const latencyMs = Date.now() - started
    const logId =
      internals.log === false
        ? null
        : await writeLog(env.DB, {
            channel: req.channel,
            kind: 'ask',
            clientId: req.clientId,
            keyId: req.keyId ?? null,
            question: extraction.content === last.content ? last.content : `${last.content}\n\n(refused for an earlier turn: ${extraction.content})`,
            answer: EXTRACTION_REPLY,
            citations: [],
            retrieved: [],
            provider: llm.provider,
            model: llm.model,
            usage: { tokensIn: 0, tokensOut: 0 },
            latencyMs,
            guarded: true,
          })
    yield { type: 'done', cited: [], provider: llm.provider, model: llm.model, latencyMs, guarded: true, logId, ...(await sign(EXTRACTION_REPLY)) }
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
  const { protectedTexts, allowTexts } = guardTexts(context, system.stable)
  const guard = createVerbatimGuard(buildGuardIndex(protectedTexts, { allowTexts }), { forbidden: PROMPT_MARKERS })
  const citations = createCitationFilter(sources.length)
  const controller = new AbortController()

  let emitted = ''
  let pending = ''
  /** Length of model text already released; `pending` starts here in the guard's offsets. */
  let releasedModel = 0
  let guarded = false
  let usage: LlmUsage | null = null
  let stopReason: LlmStopReason = 'end'
  let model = llm.model
  let failure: unknown = null

  const release = (): string => {
    const cut = Math.min(releasableIndex(pending, HOLDBACK_WORDS, HOLDBACK_LETTERS), guard.holdFrom() - releasedModel)
    if (cut <= 0) return ''
    const out = pending.slice(0, cut)
    pending = pending.slice(cut)
    releasedModel += cut
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
  if (guarded) closing = emitted.trim() ? GUARD_LINE : GUARD_LINE_FRESH
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
  yield { type: 'done', cited, provider: llm.provider, model, latencyMs, guarded, logId, ...(await sign(emitted)) }
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
        ...(ev.sig ? { sig: ev.sig } : {}),
      }
    }
  }
  throw new RagError('internal', 'The answer stream ended without finishing.')
}
