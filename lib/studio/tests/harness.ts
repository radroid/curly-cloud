/** Shared setup for the studio route tests. The test files mock @/lib/env to return `state.env`. */
import { SESSION_COOKIE, createSessionToken } from '@/lib/auth'
import type { AppEnv } from '@/lib/env'
import { createTestD1 } from '@/test/helpers/d1'

export const ADMIN_PASSWORD = 'correct horse battery staple'
export const ADMIN_TOKEN = 'admin-token-for-tests'
export const SESSION_SECRET = 'session-secret-for-tests'
export const ORIGIN = 'https://studio.test'

export function makeEnv(): AppEnv {
  return {
    DB: createTestD1(),
    ADMIN_PASSWORD,
    ADMIN_TOKEN,
    SESSION_SECRET,
    CHAT_PER_HOUR: '30',
    CHAT_PER_DAY: '120',
    FIT_PER_DAY: '10',
    MCP_ANON_PER_DAY: '40',
    DAILY_TOKEN_BUDGET: '3000000',
    MCP_REQUIRE_KEY: 'false',
  } as unknown as AppEnv
}

export const state: { env: AppEnv } = { env: makeEnv() }

export function resetEnv(): AppEnv {
  state.env = makeEnv()
  return state.env
}

export type AuthMode = 'none' | 'token' | 'session'

export interface ReqOptions {
  method?: string
  body?: unknown
  auth?: AuthMode
  headers?: Record<string, string>
}

export async function sessionCookie(): Promise<string> {
  return `${SESSION_COOKIE}=${await createSessionToken(SESSION_SECRET)}`
}

/** Build a request the way the studio's browser code (or the CLI) would send it. */
export async function req(path: string, opts: ReqOptions = {}): Promise<Request> {
  const headers = new Headers(opts.headers)
  if (opts.auth === 'token') headers.set('authorization', `Bearer ${ADMIN_TOKEN}`)
  if (opts.auth === 'session') {
    headers.set('cookie', await sessionCookie())
    if (!headers.has('sec-fetch-site')) headers.set('sec-fetch-site', 'same-origin')
  }
  let body: string | undefined
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    headers.set('content-type', 'application/json')
  }
  return new Request(ORIGIN + path, { method: opts.method ?? 'GET', headers, body })
}

export function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

export async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T
}

interface LogSeed {
  id: string
  channel?: 'web' | 'terminal' | 'mcp' | 'studio'
  question?: string
  answer?: string
  citations?: unknown[]
  retrieved?: unknown[]
  keyId?: string | null
  guarded?: boolean
  flagged?: boolean
  createdAt?: number
}

export async function seedLog(env: AppEnv, seed: LogSeed): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO chat_logs (id, channel, client_id, key_id, question, answer, citations, retrieved, provider, model, latency_ms, guarded, flagged, created_at)
     VALUES (?, ?, 'client-1', ?, ?, ?, ?, ?, 'workers-ai', 'llama', 420, ?, ?, ?)`,
  )
    .bind(
      seed.id,
      seed.channel ?? 'web',
      seed.keyId ?? null,
      seed.question ?? 'What do you build?',
      seed.answer ?? 'I build RAG systems [1].',
      JSON.stringify(seed.citations ?? []),
      JSON.stringify(seed.retrieved ?? []),
      seed.guarded ? 1 : 0,
      seed.flagged ? 1 : 0,
      seed.createdAt ?? Date.now(),
    )
    .run()
}
