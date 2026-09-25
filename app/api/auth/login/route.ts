import { z } from 'zod'
import { checkPassword, createSessionToken, sessionCookie } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { clientIdFromRequest, errorResponse, isSameOrigin, jsonResponse, rateLimit, rateLimitedResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

const ATTEMPTS_PER_HOUR = 10
const Body = z.object({ password: z.string().min(1).max(512) })

/**
 * Studio sign-in. Every failure (malformed body, wrong passphrase) gets the same 401 so the
 * response never hints at how close a guess was; checkPassword compares in constant time.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse('forbidden', 'Cross-site request blocked.')
  const env = await getAppEnv()
  if (!env.SESSION_SECRET || !env.ADMIN_PASSWORD) return errorResponse('unavailable', 'Studio sign-in is not configured.')

  const clientId = await clientIdFromRequest(request, env.SESSION_SECRET)
  const limit = await rateLimit(env.DB, `login:${clientId}`, ATTEMPTS_PER_HOUR, 3600)
  if (!limit.allowed) return rateLimitedResponse(limit)

  const parsed = Body.safeParse(await request.json().catch(() => null))
  const ok = parsed.success && (await checkPassword(env, parsed.data.password))
  if (!ok) return errorResponse('unauthorized', 'That passphrase didn’t work.')

  const secure = new URL(request.url).protocol === 'https:'
  const cookie = sessionCookie(await createSessionToken(env.SESSION_SECRET), secure)
  return jsonResponse({ ok: true }, { headers: { 'set-cookie': cookie } })
}
