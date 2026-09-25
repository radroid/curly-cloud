import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { jsonResponse } from '@/lib/security'
import { parseQuery } from '@/lib/studio/http'
import { listLogs } from '@/lib/studio/logs'
import { CHANNELS } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'

const Query = z.object({
  channel: z.enum(CHANNELS).optional(),
  flagged: z
    .enum(['1', '0', 'true', 'false'])
    .transform((v) => v === '1' || v === 'true')
    .optional(),
  q: z.string().max(200).optional(),
  key: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/** GET /api/admin/logs?channel&flagged&q&key&limit&offset → { items: LogItem[], total }, newest first. */
export async function GET(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const query = parseQuery(request, Query)
  if (!query.ok) return query.response
  const { key, ...rest } = query.data
  return jsonResponse(await listLogs(env.DB, { ...rest, keyId: key }))
}
