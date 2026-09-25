import type { Metadata } from 'next'
import { KnowledgeView } from '@/app/studio/(app)/knowledge/knowledge-view'
import type { SourceKind } from '@/lib/rag/types'
import { requireStudioSession } from '@/lib/studio/session'
import { SOURCE_KINDS } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Knowledge' }

type Search = Promise<Record<string, string | string[] | undefined>>

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function KnowledgePage({ searchParams }: { searchParams: Search }) {
  await requireStudioSession()
  const sp = await searchParams
  const kind = one(sp.kind)
  return (
    <KnowledgeView
      initial={{
        kind: SOURCE_KINDS.includes(kind as SourceKind) ? (kind as SourceKind) : '',
        topic: one(sp.topic),
        q: one(sp.q),
        page: Math.max(1, Number(one(sp.page)) || 1),
        open: one(sp.open) || null,
        panel: one(sp.panel) === 'new' || one(sp.panel) === 'import' ? (one(sp.panel) as 'new' | 'import') : null,
      }}
    />
  )
}
