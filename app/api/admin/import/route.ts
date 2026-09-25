import { requireAdmin } from '@/lib/auth'
import { getCorpusVersion } from '@/lib/db'
import { getAppEnv } from '@/lib/env'
import { answersToSources, parseExport } from '@/lib/interview'
import { ingestSources } from '@/lib/rag'
import type { IngestResult, SourceInput } from '@/lib/rag/types'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Exports are text; 2 MB is roughly 300,000 words of answers. */
const MAX_IMPORT_BYTES = 2 * 1024 * 1024
/** Stays under the /api/admin/ingest cap (500), so one call never embeds an unbounded batch. */
const BATCH = 250

function tooLarge(): Response {
  const res = errorResponse('bad_request', `Export is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`, { limitBytes: MAX_IMPORT_BYTES })
  return new Response(res.body, { status: 413, headers: res.headers })
}

/** Read the body without trusting Content-Length, stopping as soon as it passes the cap. */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.byteLength
  }
  return new TextDecoder().decode(all)
}

function mergeResults(results: IngestResult[], fallbackVersion: number): IngestResult {
  const merged: IngestResult = { upserted: 0, unchanged: 0, deleted: 0, chunks: 0, embedded: 0, errors: [], corpusVersion: fallbackVersion }
  for (const r of results) {
    merged.upserted += r.upserted
    merged.unchanged += r.unchanged
    merged.deleted += r.deleted
    merged.chunks += r.chunks
    merged.embedded += r.embedded
    merged.errors.push(...r.errors)
    merged.corpusVersion = r.corpusVersion
  }
  return merged
}

/**
 * POST a `raj-clone-answers` v1 export from interview/raj-interview.html. Each non-empty answer
 * becomes a private source (`interview:<qid>`). Returns `{ result: IngestResult, answers, skipped }`.
 */
export async function POST(request: Request): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_IMPORT_BYTES) return tooLarge()
  const raw = await readCapped(request, MAX_IMPORT_BYTES)
  if (raw === null) return tooLarge()

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return errorResponse('bad_request', 'The body is not valid JSON. Send the raj-clone-answers-*.json file exactly as exported.')
  }

  const parsed = parseExport(json)
  if (!parsed.ok) return errorResponse('bad_request', `This export has problems: ${parsed.errors[0]}`, { issues: parsed.errors })

  const sources: SourceInput[] = answersToSources(parsed.data)
  const skipped = parsed.data.answers.length - sources.length
  if (sources.length === 0) {
    const result = mergeResults([], await getCorpusVersion(env.DB))
    return jsonResponse({ result, answers: 0, skipped })
  }

  try {
    const results: IngestResult[] = []
    for (let i = 0; i < sources.length; i += BATCH) results.push(await ingestSources(env, sources.slice(i, i + BATCH)))
    return jsonResponse({ result: mergeResults(results, 0), answers: sources.length, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('import: ingest failed', message)
    return errorResponse('internal', `Ingest failed: ${message}`)
  }
}
