import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'
import { ingestSources } from '@/lib/rag'
import { errorResponse, jsonResponse } from '@/lib/security'
import { decodeId, parseBody, ragFailure } from '@/lib/studio/http'
import { getLog, getLogDetail, linkCorrection, setLogFlagged } from '@/lib/studio/logs'
import { correctionInput } from '@/lib/studio/shared'
import type { CorrectionResult } from '@/lib/studio/types'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const Flag = z.object({ flagged: z.boolean() })
const Correction = z.object({ correction: z.string().trim().min(1).max(8_000) })

/** GET → LogDetail: the full row plus the titles of the numbered and retrieved sources. */
export async function GET(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  const detail = await getLogDetail(env.DB, id)
  return detail ? jsonResponse(detail) : errorResponse('not_found', `No log ${id}.`)
}

/** PATCH { flagged } → LogItem */
export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  const body = await parseBody(request, Flag)
  if (!body.ok) return body.response
  if (!(await setLogFlagged(env.DB, id, body.data.flagged))) return errorResponse('not_found', `No log ${id}.`)
  return jsonResponse(await getLog(env.DB, id))
}

/**
 * POST { correction } → CorrectionResult. Writes (or overwrites) the private source
 * `correction:<logId>` in Raj's words, links it to the log and clears the flag.
 */
export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const env = await getAppEnv()
  const denied = await requireAdmin(request, env)
  if (denied) return denied
  const id = decodeId((await ctx.params).id)
  const body = await parseBody(request, Correction)
  if (!body.ok) return body.response
  const log = await getLog(env.DB, id)
  if (!log) return errorResponse('not_found', `No log ${id}.`)

  const input = correctionInput(log, body.data.correction)
  let result: CorrectionResult['result']
  try {
    result = await ingestSources(env, [input])
  } catch (err) {
    return ragFailure(err, 'add the correction to the knowledge base')
  }
  const failed = result.errors.find((e) => e.id === input.id)
  if (failed && result.upserted === 0 && result.unchanged === 0) {
    return errorResponse('internal', `The correction was not saved: ${failed.message}`, { result })
  }
  await linkCorrection(env.DB, id, input.id)
  const updated = await getLog(env.DB, id)
  const response: CorrectionResult = { sourceId: input.id, result, log: updated ?? log }
  return jsonResponse(response)
}
