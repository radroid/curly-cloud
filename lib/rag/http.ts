/** Small helpers shared by the clone's route handlers (chat, fit, profile, admin). */
import type { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getAppEnv, type AppEnv } from '@/lib/env'
import { RagError } from '@/lib/rag/answer'
import { IngestLimitError } from '@/lib/rag/ingest'
import { errorResponse, type ApiErrorCode } from '@/lib/security'

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response }

/** Read and parse a JSON body with a size cap. Never throws. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) return { ok: false, response: errorResponse('bad_request', 'Request body is too large.') }
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, response: errorResponse('bad_request', 'Could not read the request body.') }
  }
  if (text.length > maxBytes) return { ok: false, response: errorResponse('bad_request', 'Request body is too large.') }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, response: errorResponse('bad_request', 'Request body must be JSON.') }
  }
}

/** First few validation issues as one readable line. */
export function zodMessage(error: z.ZodError): string {
  return error.issues
    .slice(0, 4)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ')
}

const RAG_CODES: Record<RagError['code'], ApiErrorCode> = {
  bad_request: 'bad_request',
  rate_limited: 'rate_limited',
  budget_exceeded: 'budget_exceeded',
  unavailable: 'unavailable',
  internal: 'internal',
}

/** Map known errors to API errors; everything else becomes a generic 500 (no stack traces). */
export function errorFromUnknown(err: unknown, fallback = 'Something went wrong.'): Response {
  if (err instanceof RagError) return errorResponse(RAG_CODES[err.code], err.message)
  if (err instanceof IngestLimitError) return errorResponse('bad_request', err.message)
  console.error(err)
  return errorResponse('internal', fallback)
}

/** Wrap an /api/admin handler: resolve env, require admin, map errors. */
export function adminHandler(handler: (request: Request, env: AppEnv) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      const env = await getAppEnv()
      const denied = await requireAdmin(request, env)
      if (denied) return denied
      return await handler(request, env)
    } catch (err) {
      return errorFromUnknown(err)
    }
  }
}
