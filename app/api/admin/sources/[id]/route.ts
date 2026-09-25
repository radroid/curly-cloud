import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { deleteSources, getSource, ingestSources } from '@/lib/rag'
import type { SourceInput } from '@/lib/rag/types'
import { errorResponse, jsonResponse } from '@/lib/security'
import { decodeId, parseBody, ragFailure } from '@/lib/studio/http'
import { unlinkCorrection } from '@/lib/studio/logs'
import { READ_ONLY_MESSAGE, isReadOnlyKind } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const Patch = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(20_000).optional(),
    topic: z.string().trim().max(64).nullable().optional(),
    visibility: z.enum(['public', 'private']).optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), 'Nothing to update.')

/** GET /api/admin/sources/:id → SourceRecord (raw private text included; admin only). */
export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  try {
    const record = await getSource(env, id)
    return record ? jsonResponse(record) : errorResponse('not_found', `No source ${id}.`)
  } catch (err) {
    return ragFailure(err, 'load the source')
  }
}

/** PATCH { title?, body?, topic?, visibility? } → SourceRecord. Re-ingests so chunks and embeddings follow. */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  const patch = await parseBody(request, Patch)
  if (!patch.ok) return patch.response
  try {
    const existing = await getSource(env, id)
    if (!existing) return errorResponse('not_found', `No source ${id}.`)
    if (isReadOnlyKind(existing.kind)) return errorResponse('forbidden', READ_ONLY_MESSAGE)

    const input: SourceInput = {
      id: existing.id,
      kind: existing.kind,
      visibility: patch.data.visibility ?? existing.visibility,
      title: patch.data.title ?? existing.title,
      topic: patch.data.topic !== undefined ? patch.data.topic || null : existing.topic,
      anchor: existing.anchor,
      body: patch.data.body ?? existing.body,
      meta: existing.meta,
    }
    const result = await ingestSources(env, [input])
    const record = await getSource(env, id)
    if (!record) return errorResponse('internal', 'The source disappeared while saving.', { errors: result.errors })
    return jsonResponse(record)
  } catch (err) {
    return ragFailure(err, 'update the source')
  }
}

/** DELETE → { deleted }. Resume and profile sources are read-only. */
export async function DELETE(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  try {
    const existing = await getSource(env, id)
    if (!existing) return errorResponse('not_found', `No source ${id}.`)
    if (isReadOnlyKind(existing.kind)) return errorResponse('forbidden', READ_ONLY_MESSAGE)
    const deleted = await deleteSources(env, [id])
    if (existing.kind === 'correction') await unlinkCorrection(env.DB, id)
    return jsonResponse({ deleted })
  } catch (err) {
    return ragFailure(err, 'delete the source')
  }
}
