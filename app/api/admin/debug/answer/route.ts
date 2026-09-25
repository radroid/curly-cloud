import { z } from 'zod'
import { answer } from '@/lib/rag'
import { adminHandler, readJsonBody, zodMessage } from '@/lib/rag/http'
import type { ChatTurn } from '@/lib/rag/types'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

const Turn = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })
const Body = z
  .object({ question: z.string().trim().min(1).max(4000).optional(), messages: z.array(Turn).min(1).max(24).optional() })
  .refine((b) => b.question || b.messages, 'Send a question or messages.')

/** `{ question }` (or `{ messages }`) → Answer, channel 'studio'. */
export const POST = adminHandler(async (request, env) => {
  const body = await readJsonBody(request, 200_000)
  if (!body.ok) return body.response
  const parsed = Body.safeParse(body.value)
  if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))
  const messages: ChatTurn[] = parsed.data.messages ?? [{ role: 'user', content: parsed.data.question ?? '' }]
  if (messages[messages.length - 1].role !== 'user') return errorResponse('bad_request', 'The last message must be from the user.')
  return jsonResponse(await answer(env, { messages, channel: 'studio', clientId: 'studio' }))
})
