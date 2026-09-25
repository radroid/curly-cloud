/**
 * Provider-neutral LLM surface used by lib/rag. Two implementations: Anthropic (when
 * ANTHROPIC_API_KEY is set) and Workers AI (always available, no key).
 */
import type { z } from 'zod'

export type LlmProvider = 'anthropic' | 'workers-ai'

export interface LlmMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * System prompt split so providers that support prompt caching can put a breakpoint after the
 * stable prefix (identity + persona). `dynamic` is appended after the breakpoint.
 */
export interface LlmSystem {
  stable: string
  dynamic?: string | null
}

export interface LlmUsage {
  tokensIn: number
  tokensOut: number
  /** Cached prefix tokens read (Anthropic only). Included in tokensIn. */
  cacheReadTokens?: number
}

/** Normalised stop reason. `refusal` means the provider (and any fallback) declined. */
export type LlmStopReason = 'end' | 'max_tokens' | 'refusal' | 'aborted' | 'other'

export interface LlmCallOptions {
  system: string | LlmSystem
  messages: LlmMessage[]
  maxTokens?: number
  signal?: AbortSignal
}

export interface LlmGenerateOptions extends LlmCallOptions {
  /** Let the model think before answering (Anthropic adaptive thinking). Ignored by Workers AI. */
  thinking?: boolean
}

export interface LlmJsonOptions extends LlmGenerateOptions {
  /** Short identifier for the schema, used by providers that name JSON schemas. */
  schemaName?: string
}

export type LlmStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; usage: LlmUsage | null; stopReason: LlmStopReason; model: string }

export interface LlmTextResult {
  text: string
  usage: LlmUsage | null
  stopReason: LlmStopReason
  model: string
}

export interface LlmJsonResult<T> {
  data: T
  usage: LlmUsage | null
  model: string
}

export interface Llm {
  provider: LlmProvider
  /** Configured model id. The model that actually answered is reported per call. */
  model: string
  /** Yields text deltas, then exactly one `done` event with usage when the provider reports it. */
  streamText(opts: LlmCallOptions): AsyncGenerator<LlmStreamEvent>
  generateText(opts: LlmGenerateOptions): Promise<LlmTextResult>
  /** Structured output validated against `schema`. Throws LlmError when the model can't comply. */
  generateJson<T>(schema: z.ZodType<T>, opts: LlmJsonOptions): Promise<LlmJsonResult<T>>
}

export type LlmErrorCode = 'refusal' | 'invalid_output' | 'unavailable'

export class LlmError extends Error {
  constructor(
    public code: LlmErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'LlmError'
  }
}

export function systemText(system: string | LlmSystem): string {
  if (typeof system === 'string') return system
  return system.dynamic ? `${system.stable}\n\n${system.dynamic}` : system.stable
}

/** Rough token estimate (~4 chars per token) for providers that don't report usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
