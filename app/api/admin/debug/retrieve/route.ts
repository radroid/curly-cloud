import { z } from 'zod'
import { retrieve } from '@/lib/rag'
import { adminHandler, readJsonBody, zodMessage } from '@/lib/rag/http'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

const Body = z.object({
  query: z.string().trim().min(1).max(2000),
  k: z.number().int().min(1).max(50).optional(),
  rerank: z.boolean().optional(),
})

/** `{ query, k?, rerank? }` → `{ chunks: RetrievedChunk[] }` (includes private text; admin only). */
export const POST = adminHandler(async (request, env) => {
  const body = await readJsonBody(request, 16_000)
  if (!body.ok) return body.response
  const parsed = Body.safeParse(body.value)
  if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))
  const chunks = await retrieve(env, parsed.data.query, { k: parsed.data.k, rerank: parsed.data.rerank })
  return jsonResponse({ chunks })
})
