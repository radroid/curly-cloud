import { z } from 'zod'
import { checkPassword, createSessionToken, sessionCookie } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { clientIdFromRequest, errorResponse, isSameOrigin, jsonResponse, rateLimit, rateLimitedResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Per client (an IPv4 address or an IPv6 /64). */
const ATTEMPTS_PER_HOUR = 10
/**
 * Across everyone, so rotating addresses can't buy unlimited guesses. It counts every attempt,
 * not just failures: the counter is incremented atomically before the passphrase is checked, so
 * concurrent guesses can't slip past it, and the owner signs in a few times a week at most.
 * If an attacker burns it, the studio is locked for up to an hour; the CLI's ADMIN_TOKEN still works.
 */
const GLOBAL_ATTEMPTS_PER_HOUR = 30
const Body = z.object({ password: z.string().min(1).max(512) })

/**
 * Studio sign-in. Every failure (malformed body, wrong passphrase) gets the same 401 so the
 * response never hints at how close a guess was; checkPassword compares in constant time.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse('forbidden', 'Cross-site request blocked.')
  const env = await getAppEnv()
  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD) return errorResponse('unavailable', 'Studio sign-in is not configured.')

  // Per-client first: a client that's already locked out doesn't use up the global allowance.
  const clientId = await clientIdFromRequest(request, env.SESSION_SECRET)
  const limit = await rateLimit(env.DB, `login:${clientId}`, ATTEMPTS_PER_HOUR, 3600)
  if (!limit.allowed) return rateLimitedResponse(limit)
  const global = await rateLimit(env.DB, 'login:all', GLOBAL_ATTEMPTS_PER_HOUR, 3600)
  if (!global.allowed) return rateLimitedResponse(global, 'Too many sign-in attempts right now. Try again later.')

  const parsed = Body.safeParse(await request.json().catch(() => null))
  const ok = parsed.success && (await checkPassword(env, parsed.data.password))
  if (!ok) return errorResponse('unauthorized', 'That passphrase didn’t work.')

  const secure = new URL(request.url).protocol === 'https:'
  const cookie = sessionCookie(await createSessionToken(env.SESSION_SECRET), secure)
  return jsonResponse({ ok: true }, { headers: { 'set-cookie': cookie } })
}
