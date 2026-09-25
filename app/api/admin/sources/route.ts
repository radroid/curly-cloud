import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { newId } from '@/lib/db'
import { getAppEnv } from '@/lib/env'
import { getSource, ingestSources, listSources } from '@/lib/rag'
import type { SourceInput } from '@/lib/rag/types'
import { errorResponse, jsonResponse } from '@/lib/security'
import { parseBody, parseQuery, ragFailure } from '@/lib/studio/http'
import { SOURCE_KINDS } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'

const Query = z.object({
  kind: z.enum(SOURCE_KINDS).optional(),
  topic: z.string().max(64).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const NewNote = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  topic: z.string().trim().max(64).nullish(),
})

/** GET /api/admin/sources?kind&topic&q&limit&offset → { items: SourceRecord[], total } */
export async function GET(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const query = parseQuery(request, Query)
  if (!query.ok) return query.response
  try {
    return jsonResponse(await listSources(env, query.data))
  } catch (err) {
    return ragFailure(err, 'list sources')
  }
}

/** POST /api/admin/sources { title, body, topic? } → SourceRecord (a new private note). */
export async function POST(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const body = await parseBody(request, NewNote)
  if (!body.ok) return body.response

  const input: SourceInput = {
    id: newId('note:'),
    kind: 'note',
    visibility: 'private',
    title: body.data.title,
    topic: body.data.topic || 'notes',
    anchor: null,
    body: body.data.body,
    meta: { createdIn: 'studio' },
  }
  try {
    const result = await ingestSources(env, [input])
    const record = await getSource(env, input.id)
    if (!record) return errorResponse('internal', 'The note was not saved.', { errors: result.errors })
    return jsonResponse(record, { status: 201 })
  } catch (err) {
    return ragFailure(err, 'save the note')
  }
}
