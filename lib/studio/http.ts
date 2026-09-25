/**
 * Small helpers for the studio's route handlers: zod-validated JSON bodies and query strings,
 * dynamic-segment decoding, and mapping lib/rag failures onto API errors.
 */
import type { z } from 'zod'
import { errorResponse } from '@/lib/security'

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response }

function describe(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request.'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<Parsed<z.output<S>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: errorResponse('bad_request', 'Body must be JSON.') }
  }
  const result = schema.safeParse(raw)
  if (!result.success) return { ok: false, response: errorResponse('bad_request', describe(result.error)) }
  return { ok: true, data: result.data }
}

/** Query string → object (empty values dropped) → schema. */
export function parseQuery<S extends z.ZodType>(request: Request, schema: S): Parsed<z.output<S>> {
  const entries = [...new URL(request.url).searchParams.entries()].filter(([, v]) => v.trim() !== '')
  const result = schema.safeParse(Object.fromEntries(entries))
  if (!result.success) return { ok: false, response: errorResponse('bad_request', describe(result.error)) }
  return { ok: true, data: result.data }
}

/**
 * Source ids contain colons (`note:…`, `resume:exp:eddy:2`) and arrive URL-encoded. Next usually
 * decodes params already; ids never contain `%`, so decoding again is safe.
 */
export function decodeId(raw: string): string {
  if (!raw.includes('%')) return raw
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** lib/rag stubs throw "not implemented yet" until the RAG stream lands: report that as 503, not 500. */
export function ragFailure(err: unknown, action: string): Response {
  const message = messageOf(err)
  if (/not implemented/i.test(message)) {
    return errorResponse('unavailable', `The knowledge base isn't wired up yet (${message}).`)
  }
  console.error(`studio: ${action} failed`, err)
  return errorResponse('internal', `Couldn't ${action}: ${message}`)
}

export { messageOf }
