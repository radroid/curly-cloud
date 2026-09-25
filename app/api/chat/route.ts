import { z } from 'zod'
import { sseResponse } from '@/lib/client/sse'
import { getAppEnv, getLimits, type Limits } from '@/lib/env'
import { answerStream } from '@/lib/rag'
import { errorFromUnknown, readJsonBody, zodMessage } from '@/lib/rag/http'
import { clientIdFromRequest, errorResponse, publicPostGuard, rateLimitAll, rateLimitedResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** 12 turns of ≤4,000 chars fit comfortably; anything bigger is abuse. */
const MAX_BODY_BYTES = 64 * 1024
const MAX_ASSISTANT_CHARS = 4000

function chatSchema(limits: Limits) {
  const turn = z.discriminatedUnion('role', [
    z.object({ role: z.literal('user'), content: z.string().trim().min(1, 'Ask a question.').max(limits.maxQuestionChars) }),
    z.object({ role: z.literal('assistant'), content: z.string().transform((s) => s.trim().slice(0, MAX_ASSISTANT_CHARS)) }),
  ])
  return z.object({
    messages: z
      .array(turn)
      .min(1)
      .max(limits.maxTurns)
      .refine((m) => m[m.length - 1]?.role === 'user', 'The last message must be from the user.'),
    channel: z.enum(['web', 'terminal']).default('web'),
  })
}

/**
 * Clone answer stream (SSE): `sources` → `delta`* → `done` | `error`.
 * Browsers must call it same-origin with a JSON body (see publicPostGuard).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const refused = publicPostGuard(request)
    if (refused) return refused
    const env = await getAppEnv()
    const limits = getLimits(env)
    const body = await readJsonBody(request, MAX_BODY_BYTES)
    if (!body.ok) return body.response
    const parsed = chatSchema(limits).safeParse(body.value)
    if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))

    const clientId = await clientIdFromRequest(request, env.SESSION_SECRET)
    const limit = await rateLimitAll(env.DB, [
      { bucket: `chat:hour:${clientId}`, limit: limits.chatPerHour, windowSeconds: 3600 },
      { bucket: `chat:day:${clientId}`, limit: limits.chatPerDay, windowSeconds: 86_400 },
    ])
    if (!limit.allowed) return rateLimitedResponse(limit)

    return sseResponse(answerStream(env, { messages: parsed.data.messages, channel: parsed.data.channel, clientId }))
  } catch (err) {
    return errorFromUnknown(err)
  }
}
