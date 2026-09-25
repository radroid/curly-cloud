import { z } from 'zod'
import { getAppEnv, getLimits, type Limits } from '@/lib/env'
import { assessFit } from '@/lib/rag'
import { errorFromUnknown, readJsonBody, zodMessage } from '@/lib/rag/http'
import { clientIdFromRequest, errorResponse, fitRateLimit, jsonResponse, publicPostGuard, rateLimitedResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** A 12,000-character job description plus notes, JSON-escaped, stays well under this. */
const MAX_BODY_BYTES = 64 * 1024

function fitSchema(limits: Limits) {
  const optionalText = (max: number) =>
    z
      .string()
      .trim()
      .max(max)
      .nullish()
      .transform((s) => (s ? s : null))
  return z.object({
    roleTitle: z.string().trim().min(1, 'Role title is required.').max(200),
    jobDescription: z.string().trim().min(1, 'Paste the job description.').max(limits.maxJobDescriptionChars),
    company: optionalText(200),
    cultureNotes: optionalText(2000),
    channel: z.enum(['web', 'terminal']).default('web'),
  })
}

/**
 * Role-fit assessment (JSON FitAssessment). Browsers must call it same-origin with a JSON body.
 * Limits: FIT_PER_DAY per client (shared with MCP assess_fit) and FIT_GLOBAL_PER_DAY overall.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refused = publicPostGuard(request)
    if (refused) return refused
    const env = await getAppEnv()
    const limits = getLimits(env)
    const body = await readJsonBody(request, MAX_BODY_BYTES)
    if (!body.ok) return body.response
    const parsed = fitSchema(limits).safeParse(body.value)
    if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))

    const clientId = await clientIdFromRequest(request, env.SESSION_SECRET)
    const limit = await fitRateLimit(env.DB, clientId, limits)
    if (!limit.allowed) {
      return limit.scope === 'global'
        ? rateLimitedResponse(limit.result, 'The fit check has reached its daily limit. Try again tomorrow.')
        : rateLimitedResponse(limit.result)
    }

    const assessment = await assessFit(env, { ...parsed.data, clientId })
    return jsonResponse(assessment)
  } catch (err) {
    return errorFromUnknown(err, 'The fit assessment failed. Try again.')
  }
}
