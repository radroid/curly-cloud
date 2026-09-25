import { requireAdmin } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { jsonResponse } from '@/lib/security'
import { getStudioStats } from '@/lib/studio/stats'

export const dynamic = 'force-dynamic'

/** GET → StudioStats. `corpus` is null (with `corpusError`) when lib/rag can't answer. */
export async function GET(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  return jsonResponse(await getStudioStats(env))
}
