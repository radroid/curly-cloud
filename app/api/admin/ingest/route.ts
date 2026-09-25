import { z } from 'zod'
import { ingestSources, MAX_SOURCES_PER_INGEST } from '@/lib/rag'
import { adminHandler, readJsonBody, zodMessage } from '@/lib/rag/http'
import type { SourceInput } from '@/lib/rag/types'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

const KINDS = ['resume', 'profile', 'interview', 'note', 'correction'] as const

// Structure only: each source is validated inside ingestSources so one bad source lands in
// `errors[]` instead of failing the whole batch.
const IngestBody = z.object({
  sources: z.array(z.record(z.string(), z.unknown())).max(MAX_SOURCES_PER_INGEST, `At most ${MAX_SOURCES_PER_INGEST} sources per call.`),
  replaceKind: z.enum(KINDS).optional(),
})

/** `{ sources: SourceInput[], replaceKind? }` → IngestResult */
export const POST = adminHandler(async (request, env) => {
  const body = await readJsonBody(request, 16_000_000)
  if (!body.ok) return body.response
  const parsed = IngestBody.safeParse(body.value)
  if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))
  const result = await ingestSources(env, parsed.data.sources as unknown as SourceInput[], { replaceKind: parsed.data.replaceKind })
  return jsonResponse(result)
})
