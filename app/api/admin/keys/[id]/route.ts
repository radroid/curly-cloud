import { requireAdmin, revokeApiKey } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { errorResponse, jsonResponse } from '@/lib/security'
import { decodeId } from '@/lib/studio/http'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** DELETE → { revoked: true }. 404 for unknown or already-revoked keys. */
export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  if (!(await revokeApiKey(env.DB, id))) return errorResponse('not_found', `No active key ${id}.`)
  return jsonResponse({ revoked: true })
}
