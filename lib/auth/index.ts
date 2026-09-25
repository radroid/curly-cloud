import { all, first, getMeta, newId, now, run, setMeta } from '@/lib/db'
import type { AppEnv } from '@/lib/env'
import { fromBase64Url, hmacSha256, randomToken, sha256Hex, timingSafeEqual, toBase64Url } from '@/lib/security/crypto'
import { errorResponse, isSameOrigin } from '@/lib/security'

// ── Studio sessions ──────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'studio_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
/** meta key: sessions issued at or before this time (epoch ms) are revoked. Logout sets it. */
export const SESSION_EPOCH_KEY = 'session_epoch'

/**
 * v2 carries the issue time in milliseconds so logout can revoke everything issued before it,
 * even a login a moment earlier. Tokens without `v: 2` (the old seconds format) are rejected,
 * which signs the owner out once after deploy.
 */
export interface SessionPayload {
  v: 2
  sub: 'owner'
  /** Issued at, epoch ms. */
  iat: number
  /** Expires at, epoch ms. */
  exp: number
}

/** `<base64url(payload)>.<base64url(hmac)>`, signed with SESSION_SECRET. */
export async function createSessionToken(secret: string, ttlSeconds = SESSION_TTL_SECONDS, at = Date.now()): Promise<string> {
  const payload: SessionPayload = { v: 2, sub: 'owner', iat: at, exp: at + ttlSeconds * 1000 }
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = toBase64Url(await hmacSha256(secret, body))
  return `${body}.${sig}`
}

/** The signed payload of an unexpired v2 token, or null. Doesn't check revocation. */
export async function readSessionToken(secret: string, token: string | null | undefined, at = Date.now()): Promise<SessionPayload | null> {
  if (!token || !secret) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  const expected = toBase64Url(await hmacSha256(secret, body))
  if (!(await timingSafeEqual(sig, expected))) return null
  try {
    const p = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Partial<SessionPayload> | null
    if (!p || p.v !== 2 || p.sub !== 'owner' || typeof p.iat !== 'number' || typeof p.exp !== 'number') return null
    return p.exp > at ? (p as SessionPayload) : null
  } catch {
    return null
  }
}

/**
 * Signature and expiry only. `notBefore` (epoch ms) rejects tokens issued at or before it; pass
 * the session epoch, or use verifySession, which reads it from D1.
 */
export async function verifySessionToken(
  secret: string,
  token: string | null | undefined,
  at = Date.now(),
  notBefore = 0,
): Promise<boolean> {
  const payload = await readSessionToken(secret, token, at)
  return !!payload && payload.iat > notBefore
}

export async function getSessionEpoch(db: D1Database): Promise<number> {
  const n = Number(await getMeta(db, SESSION_EPOCH_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** "Log out everywhere": every session issued up to `at` stops working. */
export async function revokeAllSessions(db: D1Database, at = Date.now()): Promise<void> {
  await setMeta(db, SESSION_EPOCH_KEY, String(at))
}

/** A valid, unexpired, unrevoked studio session token. */
export async function verifySession(
  env: Pick<AppEnv, 'SESSION_SECRET' | 'DB'>,
  token: string | null | undefined,
  at = Date.now(),
): Promise<boolean> {
  const payload = await readSessionToken(env.SESSION_SECRET, token, at)
  if (!payload) return false
  return payload.iat > (await getSessionEpoch(env.DB))
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

export async function checkPassword(env: Pick<AppEnv, 'ADMIN_PASSWORD'>, candidate: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false
  return timingSafeEqual(candidate, env.ADMIN_PASSWORD)
}

// ── Admin guard ──────────────────────────────────────────────────────────────

export type AdminAuth = { via: 'token' } | { via: 'session' }

/** What admin auth needs from the env: DB holds the session epoch that logout bumps. */
export type AdminAuthEnv = Pick<AppEnv, 'ADMIN_TOKEN' | 'SESSION_SECRET' | 'DB'>

/** Bearer ADMIN_TOKEN (CLI) or a valid, unrevoked studio session cookie. */
export async function getAdminAuth(request: Request, env: AdminAuthEnv): Promise<AdminAuth | null> {
  const header = request.headers.get('authorization')
  if (header?.startsWith('Bearer ') && env.ADMIN_TOKEN) {
    if (await timingSafeEqual(header.slice(7).trim(), env.ADMIN_TOKEN)) return { via: 'token' }
    return null
  }
  if (await verifySession(env, readCookie(request, SESSION_COOKIE))) return { via: 'session' }
  return null
}

/**
 * Use at the top of every /api/admin route:
 *   const denied = await requireAdmin(request, env); if (denied) return denied
 * Cookie-authenticated mutations must also be same-origin (CSRF).
 */
export async function requireAdmin(request: Request, env: AdminAuthEnv): Promise<Response | null> {
  const auth = await getAdminAuth(request, env)
  if (!auth) return errorResponse('unauthorized', 'Sign in to the studio or pass the admin token.')
  if (auth.via === 'session' && request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request)) {
    return errorResponse('forbidden', 'Cross-site request blocked.')
  }
  return null
}

// ── API keys (for companies' agents on MCP) ──────────────────────────────────

export const API_KEY_PREFIX = 'rc_'

export interface ApiKeyRecord {
  id: string
  label: string
  prefix: string
  dailyLimit: number
  createdAt: number
  revokedAt: number | null
  lastUsedAt: number | null
  useCount: number
}

interface ApiKeyRow {
  id: string
  label: string
  prefix: string
  daily_limit: number
  created_at: number
  revoked_at: number | null
  last_used_at: number | null
  use_count: number
}

function toRecord(r: ApiKeyRow): ApiKeyRecord {
  return {
    id: r.id,
    label: r.label,
    prefix: r.prefix,
    dailyLimit: Number(r.daily_limit),
    createdAt: Number(r.created_at),
    revokedAt: r.revoked_at == null ? null : Number(r.revoked_at),
    lastUsedAt: r.last_used_at == null ? null : Number(r.last_used_at),
    useCount: Number(r.use_count),
  }
}

/** Creates a key and returns the plaintext token once. Only the SHA-256 hash is stored. */
export async function createApiKey(db: D1Database, label: string, dailyLimit = 500): Promise<{ token: string; record: ApiKeyRecord }> {
  const token = API_KEY_PREFIX + randomToken(24)
  const id = newId('key_')
  const prefix = token.slice(0, 10)
  const at = now()
  await run(
    db,
    'INSERT INTO api_keys (id, label, prefix, token_hash, daily_limit, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    label.trim().slice(0, 120),
    prefix,
    await sha256Hex(token),
    dailyLimit,
    at,
  )
  return {
    token,
    record: { id, label, prefix, dailyLimit, createdAt: at, revokedAt: null, lastUsedAt: null, useCount: 0 },
  }
}

/** Resolve a bearer token to an active key and record the use. Returns null for unknown or revoked keys. */
export async function verifyApiKey(db: D1Database, token: string): Promise<ApiKeyRecord | null> {
  if (!token.startsWith(API_KEY_PREFIX)) return null
  const row = await first<ApiKeyRow>(
    db,
    'UPDATE api_keys SET last_used_at = ?, use_count = use_count + 1 WHERE token_hash = ? AND revoked_at IS NULL RETURNING *',
    now(),
    await sha256Hex(token),
  )
  return row ? toRecord(row) : null
}

export async function listApiKeys(db: D1Database): Promise<ApiKeyRecord[]> {
  return (await all<ApiKeyRow>(db, 'SELECT * FROM api_keys ORDER BY created_at DESC')).map(toRecord)
}

export async function revokeApiKey(db: D1Database, id: string): Promise<boolean> {
  const res = await run(db, 'UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', now(), id)
  return (res.meta?.changes ?? 0) > 0
}
