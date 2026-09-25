import type { Metadata } from 'next'
import { KnowledgeView } from '@/app/studio/(app)/knowledge/knowledge-view'
import { getAppEnv } from '@/lib/env'
import { listSources } from '@/lib/rag'
import type { SourceKind, SourceRecord } from '@/lib/rag/types'
import { requireStudioSession } from '@/lib/studio/session'
import { SOURCE_KINDS, SOURCES_PAGE_SIZE } from '@/lib/studio/shared'
import type { Page } from '@/lib/studio/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Knowledge' }

type Search = Promise<Record<string, string | string[] | undefined>>

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function KnowledgePage({ searchParams }: { searchParams: Search }) {
  await requireStudioSession()
  const sp = await searchParams
  const kindParam = one(sp.kind)
  const kind = SOURCE_KINDS.includes(kindParam as SourceKind) ? (kindParam as SourceKind) : ''
  const topic = one(sp.topic)
  const q = one(sp.q)
  const page = Math.max(1, Number(one(sp.page)) || 1)
  const panel = one(sp.panel)

  // First page on the server when lib/rag can answer; otherwise the client shows why it can't.
  let initialData: Page<SourceRecord> | undefined
  try {
    initialData = await listSources(await getAppEnv(), {
      kind: kind || undefined,
      topic: topic || undefined,
      q: q.trim() || undefined,
      limit: SOURCES_PAGE_SIZE,
      offset: (page - 1) * SOURCES_PAGE_SIZE,
    })
  } catch {
    initialData = undefined
  }

  return (
    <KnowledgeView
      initial={{ kind, topic, q, page, open: one(sp.open) || null, panel: panel === 'new' || panel === 'import' ? panel : null }}
      initialData={initialData}
    />
  )
}
