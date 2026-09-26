import { dayKey, first, run } from '@/lib/db'
import type { Limits } from '@/lib/env'
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

const DAY_SECONDS = 86_400

/**
 * The daily assess_fit limits, shared by the website, the terminal and MCP: one bucket per
 * client (so web and MCP don't each get a full allowance) and one global cap across everyone.
 * `subject` is the pseudonymous client id, or `key:<id>` for an MCP API key.
 * The per-client bucket is counted first, so a client that is already over its own limit
 * never eats into the global cap.
 */
export async function fitRateLimit(
  db: D1Database,
  subject: string,
  limits: Pick<Limits, 'fitPerDay' | 'fitGlobalPerDay'>,
): Promise<{ allowed: true } | { allowed: false; scope: 'client' | 'global'; result: RateLimitResult }> {
  const own = await rateLimit(db, `fit:day:${subject}`, limits.fitPerDay, DAY_SECONDS)
  if (!own.allowed) return { allowed: false, scope: 'client', result: own }
  const everyone = await rateLimit(db, 'fit:all', limits.fitGlobalPerDay, DAY_SECONDS)
  if (!everyone.allowed) return { allowed: false, scope: 'global', result: everyone }
  return { allowed: true }
}

// ── Client identity ──────────────────────────────────────────────────────────

/** Parse one IPv6 address (no zone, no brackets) into 8 hextets. Null when malformed. */
function ipv6Hextets(ip: string): number[] | null {
  let text = ip
  let tail: number[] = []
  // A dotted IPv4 tail (`::ffff:1.2.3.4`, `64:ff9b::1.2.3.4`) is the last two hextets.
  const dotted = /^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text)
  if (dotted) {
    const octets = dotted[2].split('.').map(Number)
    if (octets.some((o) => o > 255)) return null
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]]
    text = dotted[1].endsWith('::') ? dotted[1] : dotted[1].slice(0, -1)
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const parse = (part: string): number[] | null => {
    if (part === '') return []
    const groups = part.split(':')
    if (groups.some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null
    return groups.map((g) => parseInt(g, 16))
  }
  const head = parse(halves[0])
  const rest = halves.length === 2 ? parse(halves[1]) : []
  if (!head || !rest) return null
  const given = head.length + rest.length + tail.length
  if (halves.length === 2) {
    if (given > 7) return null
    return [...head, ...new Array<number>(8 - given).fill(0), ...rest, ...tail]
  }
  return given === 8 ? [...head, ...tail] : null
}

/**
 * The unit a rate limit applies to. IPv4 stays per address. IPv6 is grouped by its /64 prefix,
 * since one subscriber usually holds a whole /64 and can rotate through it at will.
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) counts as the IPv4 address. Anything unparseable is used
 * as-is (lowercased), which is still one bucket per distinct value.
 */
export function rateLimitSubject(rawIp: string): string {
  const ip = rawIp
    .trim()
    .replace(/^\[([^\]]*)\](?::\d+)?$/, '$1')
    .replace(/%.*$/, '')
    .toLowerCase()
  if (!ip.includes(':')) return ip
  const h = ipv6Hextets(ip)
  if (!h) return ip
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return [h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff].join('.')
  }
  return `${h
    .slice(0, 4)
    .map((x) => x.toString(16))
    .join(':')}::/64`
}

/**
 * Pseudonymous client id: HMAC of the visitor's rate-limit subject (IPv4 address or IPv6 /64)
 * with a salt that rotates daily, truncated. Stable within a day (so limits work), unlinkable
 * across days, never stores the IP.
 */
export async function clientIdFromRequest(request: Request, secret: string, at: number = Date.now()): Promise<string> {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  const digest = await hmacSha256(`${secret}:${dayKey(at)}`, rateLimitSubject(ip))
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
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'rate_limited'
  | 'budget_exceeded'
  | 'unavailable'
  | 'internal'

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  budget_exceeded: 503,
  unavailable: 503,
  internal: 500,
}

export function errorResponse(code: ApiErrorCode, message: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse({ error: { code, message, ...extra } }, { status: STATUS[code] })
}

export function rateLimitedResponse(r: RateLimitResult, message = 'Too many requests. Try again later.'): Response {
  const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  return jsonResponse(
    { error: { code: 'rate_limited', message, retryAfterSeconds: retryAfter } },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  )
}

/**
 * Browser cross-site check (CSRF for cookie routes, quota theft for public LLM routes): the
 * request must come from this origin. Browsers always send Sec-Fetch-Site or Origin on
 * cross-site POSTs; either one saying "elsewhere" is enough to refuse. `Origin: null` (sandboxed
 * iframes, file://, some redirects) and malformed origins count as cross-site.
 * Requests with neither header (curl, server-side clients) pass: they can't ride a visitor's
 * cookies or IP, and they're still limited per client.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return false
  const origin = request.headers.get('origin')
  if (origin === null) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

/** True for `application/json`, with or without parameters (`; charset=utf-8`). */
export function isJsonContentType(request: Request): boolean {
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  return type === 'application/json'
}

/**
 * Gate for the public LLM routes (/api/chat, /api/fit). Without it any website could POST from
 * its visitors' browsers (`mode: 'no-cors'`, text/plain) and spend the quota from their IPs.
 * Requiring application/json forces a CORS preflight, which this app never answers, and the
 * origin check refuses browser requests that do reach us from another site.
 */
export function publicPostGuard(request: Request): Response | null {
  if (!isSameOrigin(request)) return errorResponse('forbidden', 'Cross-site requests are not allowed. Call this API from curlycloud.dev.')
  if (!isJsonContentType(request)) return errorResponse('unsupported_media_type', 'Send the body as JSON with Content-Type: application/json.')
  return null
}

/**
 * Read the body as UTF-8 text without trusting Content-Length: a declared length over the cap is
 * refused up front, and a chunked body is read as a stream and abandoned as soon as it passes
 * the cap. Returns null when the body is too large. Stream errors propagate.
 */
export async function readCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > max) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(all)
}
