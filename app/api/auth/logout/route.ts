import { clearSessionCookie } from '@/lib/auth'
import { errorResponse, isSameOrigin, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * Clears the studio session. Plain form posts (Accept: text/html) are redirected back to the
 * login page so the nav's logout button works without JavaScript; fetch callers get JSON.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return errorResponse('forbidden', 'Cross-site request blocked.')
  const headers = new Headers({ 'set-cookie': clearSessionCookie(), 'cache-control': 'no-store' })
  if (request.headers.get('accept')?.includes('text/html')) {
    headers.set('location', '/studio/login')
    return new Response(null, { status: 303, headers })
  }
  return jsonResponse({ ok: true }, { headers })
}
