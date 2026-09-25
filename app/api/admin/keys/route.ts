import { z } from 'zod'
import { createApiKey, requireAdmin } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { jsonResponse } from '@/lib/security'
import { parseBody } from '@/lib/studio/http'
import { listKeysWithUsage } from '@/lib/studio/keys'
import type { CreatedKey } from '@/lib/studio/types'

export const dynamic = 'force-dynamic'

const NewKey = z.object({
  label: z.string().trim().min(1).max(120),
  dailyLimit: z.number().int().min(1).max(100_000).optional(),
})

/** GET → { items: KeyItem[] } with today's usage. Tokens are never returned here. */
export async function GET(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  return jsonResponse({ items: await listKeysWithUsage(env.DB) })
}

/** POST { label, dailyLimit? } → { token, record }. The only time the plaintext token exists. */
export async function POST(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const body = await parseBody(request, NewKey)
  if (!body.ok) return body.response
  const created: CreatedKey = await createApiKey(env.DB, body.data.label, body.data.dailyLimit)
  return jsonResponse(created, { status: 201 })
}
