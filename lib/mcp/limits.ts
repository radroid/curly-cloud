/**
 * Limits for the LLM-backed tools (ask_raj, assess_fit) and the tool-level error results agents
 * see when a call can't go ahead. Errors are always `isError: true` results with a clear next
 * step, never protocol errors. They carry no `structuredContent`: clients validate it against
 * the output schema even on errors.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { RESUME } from '@/content/resume'
import type { ApiKeyRecord } from '@/lib/auth'
import { getLimits, type AppEnv } from '@/lib/env'
import type { AnswerErrorCode } from '@/lib/rag/types'
import { budgetRemaining, fitRateLimit, rateLimit, type RateLimitResult } from '@/lib/security'

export const DAY_SECONDS = 86_400

export type LlmTool = 'ask_raj' | 'assess_fit'

export interface CallerContext {
  env: AppEnv
  /** Pseudonymous client id for anonymous callers, `key:<id>` for API keys (see lib/mcp/http.ts). */
  clientId: string
  key: ApiKeyRecord | null
}

export type ToolErrorCode = 'rate_limited' | 'fit_limited' | 'budget_exceeded' | 'unavailable' | 'bad_request'

const FREE_TOOLS = 'get_profile, get_resume, list_topics and the resume resource still work and do not count against limits'

export function toolError(code: ToolErrorCode, text: string, extra: Record<string, unknown> = {}): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text }],
    _meta: { 'curlycloud.dev/error': { code, ...extra } },
  }
}

function inAbout(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.max(1, Math.ceil((seconds % 3600) / 60))
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function limitedResult(code: 'rate_limited' | 'fit_limited', what: string, r: RateLimitResult, keyed: boolean, global = false): CallToolResult {
  const retryAfterSeconds = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  const resetsAt = new Date(r.resetAt).toISOString()
  const upgrade = global
    ? `An API key doesn't raise this limit; email Raj at ${RESUME.email} if it's urgent.`
    : keyed
      ? `If your company needs a higher limit, email Raj at ${RESUME.email}.`
      : `For a higher limit, email Raj at ${RESUME.email} for an API key and send it as "Authorization: Bearer rc_…".`
  return toolError(
    code,
    `Rate limited: ${what}. Retry in about ${inAbout(retryAfterSeconds)} (limits reset at ${resetsAt}). Meanwhile, ${FREE_TOOLS}. ${upgrade}`,
    { retryAfterSeconds, resetsAt },
  )
}

/**
 * Checks the daily token budget, then counts the call against the caller's daily limit (and the
 * assess_fit limit). Returns an error result to send back, or null when the call may proceed.
 */
export async function gateLlmCall(ctx: CallerContext, tool: LlmTool): Promise<CallToolResult | null> {
  const { env, key, clientId } = ctx
  const limits = getLimits(env)

  if ((await budgetRemaining(env.DB, limits.dailyTokenBudget)) <= 0) return budgetExhausted()

  const daily = key
    ? await rateLimit(env.DB, `mcp:k:${key.id}`, key.dailyLimit, DAY_SECONDS)
    : await rateLimit(env.DB, `mcp:a:${clientId}`, limits.mcpAnonPerDay, DAY_SECONDS)
  if (!daily.allowed) {
    const who = key ? `this API key allows ${key.dailyLimit}` : `anonymous clients get ${limits.mcpAnonPerDay}`
    return limitedResult('rate_limited', `${who} ask_raj/assess_fit calls per day`, daily, !!key)
  }

  if (tool === 'assess_fit') {
    // Same buckets as /api/fit: an anonymous agent shares its IP's allowance with the website.
    const fit = await fitRateLimit(env.DB, key ? `key:${key.id}` : clientId, limits)
    if (!fit.allowed) {
      return fit.scope === 'client'
        ? limitedResult('fit_limited', `assess_fit is limited to ${limits.fitPerDay} calls per day`, fit.result, !!key)
        : limitedResult('fit_limited', `assess_fit has reached its daily limit of ${limits.fitGlobalPerDay} calls across all clients`, fit.result, !!key, true)
    }
  }
  return null
}

function budgetExhausted(): CallToolResult {
  return toolError(
    'budget_exceeded',
    `The clone has used its daily AI budget, so it can't generate answers until the budget resets at 00:00 UTC. Meanwhile, ${FREE_TOOLS}. You can also email Raj at ${RESUME.email}.`,
  )
}

const KNOWN_CODES: AnswerErrorCode[] = ['rate_limited', 'budget_exceeded', 'bad_request', 'unavailable', 'internal']

function errorCode(err: unknown): AnswerErrorCode {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && (KNOWN_CODES as string[]).includes(code) ? (code as AnswerErrorCode) : 'unavailable'
}

/** Turn anything lib/rag throws into a result the agent can act on. */
export function ragFailure(err: unknown, tool: LlmTool): CallToolResult {
  const code = errorCode(err)
  if (code === 'budget_exceeded') return budgetExhausted()
  if (code === 'bad_request') {
    const detail = err instanceof Error && err.message ? ` ${err.message}` : ''
    return toolError('bad_request', `The clone couldn't process that request.${detail} Rephrase or shorten it and try again.`)
  }
  if (code === 'rate_limited') {
    return toolError('rate_limited', `Rate limited by the clone. Retry in a few minutes. Meanwhile, ${FREE_TOOLS}.`, { retryAfterSeconds: 300 })
  }
  console.error(`mcp ${tool}: clone unavailable`, err)
  return toolError(
    'unavailable',
    `The clone is unavailable right now, so ${tool} couldn't run. Try again in a few minutes. Meanwhile, ${FREE_TOOLS}, and you can email Raj at ${RESUME.email}.`,
  )
}
