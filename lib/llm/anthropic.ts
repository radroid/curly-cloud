/**
 * Anthropic provider (used when ANTHROPIC_API_KEY is set).
 *
 * - Beta Messages API so we can opt into server-side refusal fallbacks
 *   (`fallbacks: 'default'` + `server-side-fallback-2026-07-01`): if Claude's safety classifiers
 *   decline, the API re-runs the request on Anthropic's recommended fallback model in the same call.
 * - Prompt-caching breakpoint on the stable system prefix (identity + persona).
 * - Chat runs with thinking disabled at low effort for latency; JSON calls can opt into adaptive
 *   thinking (the fit assessment does).
 * - Structured outputs via `output_config.format` + `betaZodOutputFormat`, validated again with zod.
 */
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { z } from 'zod'
import { describeIssues, extractJson } from '@/lib/llm/json'
import {
  LlmError,
  type Llm,
  type LlmCallOptions,
  type LlmGenerateOptions,
  type LlmJsonOptions,
  type LlmJsonResult,
  type LlmStopReason,
  type LlmStreamEvent,
  type LlmSystem,
  type LlmTextResult,
  type LlmUsage,
} from '@/lib/llm/types'

export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/** The slice of the SDK client this module uses; tests pass a mock with the same shape. */
export interface AnthropicClientLike {
  beta: {
    messages: {
      stream: Anthropic['beta']['messages']['stream']
      parse: Anthropic['beta']['messages']['parse']
    }
  }
}

type SystemBlocks = Anthropic.Beta.BetaTextBlockParam[]

export function systemBlocks(system: string | LlmSystem): SystemBlocks {
  const s: LlmSystem = typeof system === 'string' ? { stable: system } : system
  const blocks: SystemBlocks = [{ type: 'text', text: s.stable, cache_control: { type: 'ephemeral' } }]
  if (s.dynamic) blocks.push({ type: 'text', text: s.dynamic })
  return blocks
}

function messageParams(opts: LlmCallOptions): Anthropic.Beta.BetaMessageParam[] {
  return opts.messages.map((m) => ({ role: m.role, content: m.content }))
}

export function usageOf(u: Anthropic.Beta.BetaUsage | null | undefined): LlmUsage | null {
  if (!u) return null
  const cacheRead = u.cache_read_input_tokens ?? 0
  return {
    tokensIn: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + cacheRead,
    tokensOut: u.output_tokens ?? 0,
    cacheReadTokens: cacheRead,
  }
}

export function stopReasonOf(reason: Anthropic.Beta.BetaStopReason | null | undefined): LlmStopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end'
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return 'max_tokens'
    case 'refusal':
      return 'refusal'
    default:
      return 'other'
  }
}

function thinkingParam(on: boolean | undefined): Anthropic.Beta.BetaThinkingConfigParam {
  return on ? { type: 'adaptive' } : { type: 'disabled' }
}

export function createAnthropicLlm(opts: { apiKey?: string; model: string; client?: AnthropicClientLike }): Llm {
  const model = opts.model
  const client: AnthropicClientLike = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 1, timeout: 90_000 })

  async function* streamText(call: LlmCallOptions): AsyncGenerator<LlmStreamEvent> {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: call.maxTokens ?? 1024,
        system: systemBlocks(call.system),
        messages: messageParams(call),
        // Chat is latency-sensitive: no thinking, low effort. Allowed at effort <= high.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      },
      { signal: call.signal },
    )
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text }
        }
      }
      const final = await stream.finalMessage()
      yield { type: 'done', usage: usageOf(final.usage), stopReason: stopReasonOf(final.stop_reason), model: final.model ?? model }
    } catch (err) {
      if (call.signal?.aborted) {
        yield { type: 'done', usage: null, stopReason: 'aborted', model }
        return
      }
      throw err
    }
  }

  async function generateText(call: LlmGenerateOptions): Promise<LlmTextResult> {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: call.maxTokens ?? 4096,
        system: systemBlocks(call.system),
        messages: messageParams(call),
        thinking: thinkingParam(call.thinking),
        output_config: { effort: call.thinking ? 'medium' : 'low' },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      },
      { signal: call.signal },
    )
    const final = await stream.finalMessage()
    const stopReason = stopReasonOf(final.stop_reason)
    if (stopReason === 'refusal') throw new LlmError('refusal', 'The model declined this request.')
    const text = final.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    return { text, usage: usageOf(final.usage), stopReason, model: final.model ?? model }
  }

  async function generateJson<T>(schema: z.ZodType<T>, call: LlmJsonOptions): Promise<LlmJsonResult<T>> {
    const response = await client.beta.messages.parse(
      {
        model,
        max_tokens: call.maxTokens ?? 16000,
        system: systemBlocks(call.system),
        messages: messageParams(call),
        thinking: thinkingParam(call.thinking),
        output_config: { effort: call.thinking ? 'medium' : 'low', format: betaZodOutputFormat(schema) },
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
      },
      { signal: call.signal },
    )
    if (response.stop_reason === 'refusal') throw new LlmError('refusal', 'The model declined this request.')
    const usage = usageOf(response.usage)
    const candidate =
      response.parsed_output ?? extractJson(response.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
    const parsed = schema.safeParse(candidate)
    if (!parsed.success) {
      throw new LlmError('invalid_output', `Claude returned JSON that failed validation: ${describeIssues(parsed.error)}`)
    }
    return { data: parsed.data, usage, model: response.model ?? model }
  }

  return { provider: 'anthropic', model, streamText, generateText, generateJson }
}
