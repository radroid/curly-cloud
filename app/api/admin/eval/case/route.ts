import { z } from 'zod'
import { runEvalCase } from '@/lib/rag/eval'
import { adminHandler, readJsonBody, zodMessage } from '@/lib/rag/http'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

const Turn = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })
const EvalCaseBody = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['retrieval', 'answer', 'refusal', 'injection']),
  question: z.string().trim().min(1).max(4000),
  history: z.array(Turn).max(24).optional(),
  expect: z.array(z.string().min(1)).max(20).optional(),
  mustInclude: z.array(z.string().min(1)).max(20).optional(),
  mustNotInclude: z.array(z.string().min(1)).max(40).optional(),
  mustNotMatch: z.array(z.string().min(1).max(300)).max(20).optional(),
  mustCite: z.boolean().optional(),
  k: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(2000).optional(),
})

/** Run one eval case (see evals/README.md). `?rerank=0` disables the reranker for A/B runs. → EvalCaseResult */
export const POST = adminHandler(async (request, env) => {
  const body = await readJsonBody(request, 200_000)
  if (!body.ok) return body.response
  const parsed = EvalCaseBody.safeParse(body.value)
  if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))
  const rerankParam = new URL(request.url).searchParams.get('rerank')
  const rerank = rerankParam === null ? undefined : rerankParam !== '0' && rerankParam !== 'false'
  return jsonResponse(await runEvalCase(env, parsed.data, { rerank }))
})
