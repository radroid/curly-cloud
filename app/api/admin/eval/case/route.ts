import { EvalCaseSchema, runEvalCase } from '@/lib/rag/eval'
import { adminHandler, readJsonBody, zodMessage } from '@/lib/rag/http'
import { errorResponse, jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Run one eval case (see evals/README.md). `?rerank=0` disables the reranker for A/B runs. → EvalCaseResult */
export const POST = adminHandler(async (request, env) => {
  const body = await readJsonBody(request, 200_000)
  if (!body.ok) return body.response
  const parsed = EvalCaseSchema.safeParse(body.value)
  if (!parsed.success) return errorResponse('bad_request', zodMessage(parsed.error))
  const rerankParam = new URL(request.url).searchParams.get('rerank')
  const rerank = rerankParam === null ? undefined : rerankParam !== '0' && rerankParam !== 'false'
  return jsonResponse(await runEvalCase(env, parsed.data, { rerank }))
})
