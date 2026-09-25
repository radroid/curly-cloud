import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Everything a server module needs from the Worker environment: bindings (DB, AI), vars from
 * wrangler.jsonc, and secrets from .dev.vars / `wrangler secret put`.
 * ANTHROPIC_API_KEY is optional, so it's declared here rather than generated.
 */
export type AppEnv = CloudflareEnv & {
  ANTHROPIC_API_KEY?: string
}

/** Resolve the Worker env inside a route handler or server component. */
export async function getAppEnv(): Promise<AppEnv> {
  const { env } = await getCloudflareContext({ async: true })
  return env as AppEnv
}

/** Read a numeric var with a fallback; vars arrive as strings. */
export function numVar(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Limits and switches, resolved once per request from vars. */
export interface Limits {
  chatPerHour: number
  chatPerDay: number
  fitPerDay: number
  mcpAnonPerDay: number
  dailyTokenBudget: number
  mcpRequireKey: boolean
  maxQuestionChars: number
  maxJobDescriptionChars: number
  maxTurns: number
}

export function getLimits(env: Pick<AppEnv, 'CHAT_PER_HOUR' | 'CHAT_PER_DAY' | 'FIT_PER_DAY' | 'MCP_ANON_PER_DAY' | 'DAILY_TOKEN_BUDGET' | 'MCP_REQUIRE_KEY'>): Limits {
  return {
    chatPerHour: numVar(env.CHAT_PER_HOUR, 30),
    chatPerDay: numVar(env.CHAT_PER_DAY, 120),
    fitPerDay: numVar(env.FIT_PER_DAY, 10),
    mcpAnonPerDay: numVar(env.MCP_ANON_PER_DAY, 40),
    dailyTokenBudget: numVar(env.DAILY_TOKEN_BUDGET, 3_000_000),
    mcpRequireKey: String(env.MCP_REQUIRE_KEY) === 'true',
    maxQuestionChars: 1_000,
    maxJobDescriptionChars: 12_000,
    maxTurns: 12,
  }
}
