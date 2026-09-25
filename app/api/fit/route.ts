import { z } from 'zod'
import { getAppEnv, getLimits, type Limits } from '@/lib/env'
import { assessFit } from '@/lib/rag'
import { errorFromUnknown, readJsonBody, zodMessage } from '@/lib/rag/http'
import { clientIdFromRequest, errorResponse, jsonResponse, rateLimitAll, rateLimitedResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

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

/** Role-fit assessment (JSON FitAssessment). */
export async function POST(request: Request): Promise<Response> {
  try {
    const env = await getAppEnv()
    const limits = getLimits(env)
    const body = await readJsonBody(request, limits.maxJobDescriptionChars * 2 + 8_000)
    if (!body.ok) return body.response
    const parsed = fitSchema(limits).safeParse(body.value)
    if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))

    const clientId = await clientIdFromRequest(request, env.SESSION_SECRET)
    const limit = await rateLimitAll(env.DB, [{ bucket: `fit:day:${clientId}`, limit: limits.fitPerDay, windowSeconds: 86_400 }])
    if (!limit.allowed) return rateLimitedResponse(limit)

    const assessment = await assessFit(env, { ...parsed.data, clientId })
    return jsonResponse(assessment)
  } catch (err) {
    return errorFromUnknown(err, 'The fit assessment failed. Try again.')
  }
}
