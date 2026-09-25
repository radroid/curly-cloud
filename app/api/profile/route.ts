import { RESUME } from '@/content/resume'
import { getAppEnv } from '@/lib/env'
import { listTopics } from '@/lib/rag'
import type { TopicSummary } from '@/lib/rag/types'
import { jsonResponse } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** Public profile: the resume (same data as content/resume.ts) plus topic coverage counts. */
export async function GET(): Promise<Response> {
  let topics: TopicSummary[] = []
  try {
    topics = await listTopics(await getAppEnv())
  } catch (err) {
    // The resume is static; serve it even if the knowledge base is unreachable.
    console.error('profile topics failed', err)
  }
  const res = jsonResponse({ resume: RESUME, topics })
  res.headers.set('cache-control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600')
  return res
}
