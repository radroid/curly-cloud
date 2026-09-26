import { getCorpusVersion } from '@/lib/db'
import { getAppEnv } from '@/lib/env'
import { jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Liveness plus a cheap check that the D1 binding answers. */
export async function GET(): Promise<Response> {
  const env = await getAppEnv()
  const corpusVersion = await getCorpusVersion(env.DB)
  return jsonResponse({ ok: true, corpusVersion, llm: env.ANTHROPIC_API_KEY ? 'anthropic' : 'workers-ai' })
}
