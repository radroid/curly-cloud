import { SESSION_COOKIE, clearSessionCookie, readCookie, revokeAllSessions, verifySession } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { errorResponse, isSameOrigin, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * Logs out everywhere: clears this cookie and, when the caller holds a valid session, bumps the
 * session epoch so every session issued before now (including copies of this cookie) stops
 * working. Without a valid session it only clears the cookie, so a stranger can't sign the
 * owner out. Plain form posts (Accept: text/html) are redirected back to the login page so the
 * nav's logout button works without JavaScript; fetch callers get JSON.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse('forbidden', 'Cross-site request blocked.')
  const env = await getAppEnv()
  if (await verifySession(env, readCookie(request, SESSION_COOKIE))) await revokeAllSessions(env.DB)
  const headers = new Headers({ 'set-cookie': clearSessionCookie(), 'cache-control': 'no-store' })
  if (request.headers.get('accept')?.includes('text/html')) {
    headers.set('location', '/studio/login')
    return new Response(null, { status: 303, headers })
  }
  return jsonResponse({ ok: true }, { headers })
}
