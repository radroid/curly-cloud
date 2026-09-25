import { dayKey, first, run } from '@/lib/db'
import { hmacSha256, toHex } from '@/lib/security/crypto'

// ── Rate limiting ────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Fixed-window counter in D1. One statement: insert, or reset if the window rolled over,
 * or increment. The returned count decides the outcome, so concurrent requests can't both
 * slip under the limit.
 */
export async function rateLimit(
  db: D1Database,
  bucket: string,
  limit: number,
  windowSeconds: number,
  at: number = Date.now(),
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000
  const windowStart = Math.floor(at / windowMs) * windowMs
  const row = await first<{ count: number; window_start: number }>(
    db,
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT (bucket) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count, window_start`,
    bucket,
    windowStart,
  )
  const count = Number(row?.count ?? 1)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: windowStart + windowMs }
}

/** Check several windows at once (e.g. per-hour and per-day). All are counted; the first failure wins. */
export async function rateLimitAll(
  db: D1Database,
  checks: { bucket: string; limit: number; windowSeconds: number }[],
): Promise<RateLimitResult> {
  let result: RateLimitResult = { allowed: true, remaining: Infinity, resetAt: 0 }
  for (const c of checks) {
    const r = await rateLimit(db, c.bucket, c.limit, c.windowSeconds)
    if (!r.allowed) return r
    if (r.remaining < result.remaining) result = r
  }
  return result
}

// ── Client identity ──────────────────────────────────────────────────────────

/**
 * Pseudonymous client id: HMAC of the visitor IP with a salt that rotates daily, truncated.
 * Stable within a day (so limits work), unlinkable across days, never stores the IP.
 */
export async function clientIdFromRequest(request: Request, secret: string, at: number = Date.now()): Promise<string> {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const digest = await hmacSha256(`${secret}:${dayKey(at)}`, ip)
  return toHex(digest).slice(0, 20)
}

// ── Daily token budget ───────────────────────────────────────────────────────

export async function budgetRemaining(db: D1Database, dailyBudget: number, at: number = Date.now()): Promise<number> {
  const row = await first<{ tokens_in: number; tokens_out: number }>(
    db,
    'SELECT tokens_in, tokens_out FROM usage_daily WHERE day = ?',
    dayKey(at),
  )
  const used = Number(row?.tokens_in ?? 0) + Number(row?.tokens_out ?? 0)
  return dailyBudget - used
}

export async function recordUsage(db: D1Database, tokensIn: number, tokensOut: number, at: number = Date.now()): Promise<void> {
  await run(
    db,
    `INSERT INTO usage_daily (day, requests, tokens_in, tokens_out) VALUES (?, 1, ?, ?)
     ON CONFLICT (day) DO UPDATE SET requests = requests + 1, tokens_in = tokens_in + excluded.tokens_in, tokens_out = tokens_out + excluded.tokens_out`,
    dayKey(at),
    Math.max(0, Math.round(tokensIn)),
    Math.max(0, Math.round(tokensOut)),
  )
}

// ── Redaction ────────────────────────────────────────────────────────────────

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// Candidate spans that look like phone numbers; kept only if they hold 7–15 digits.
const PHONE_CANDIDATE = /(?<![\w.])\+?[\d(][\d\s().-]{5,}\d(?![\w%])/g

/** Strip emails and phone numbers from visitor text before it's logged. */
export function redactPii(text: string): string {
  return text.replace(EMAIL, '[email]').replace(PHONE_CANDIDATE, (m) => {
    const digits = m.replace(/\D/g, '').length
    return digits >= 7 && digits <= 15 ? '[phone]' : m
  })
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'budget_exceeded'
  | 'unavailable'
  | 'internal'

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  budget_exceeded: 503,
  unavailable: 503,
  internal: 500,
}

export function errorResponse(code: ApiErrorCode, message: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error: { code, message, ...extra } }, { status: STATUS[code] })
}

export function rateLimitedResponse(r: RateLimitResult): Response {
  const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  return jsonResponse(
    { error: { code: 'rate_limited', message: 'Too many requests. Try again later.', retryAfterSeconds: retryAfter } },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  )
}

/**
 * CSRF check for cookie-authenticated mutations: the request must come from this origin.
 * Browsers always send Sec-Fetch-Site or Origin on cross-site POSTs.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'none'
  const origin = request.headers.get('origin')
  if (!origin) return true
  return new URL(origin).host === new URL(request.url).host
}
