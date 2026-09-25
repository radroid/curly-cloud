import type { Metadata } from 'next'
import { LogsView } from '@/app/studio/(app)/logs/logs-view'
import type { Channel } from '@/lib/rag/types'
import { requireStudioSession } from '@/lib/studio/session'
import { CHANNELS } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conversations' }

type Search = Promise<Record<string, string | string[] | undefined>>

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function LogsPage({ searchParams }: { searchParams: Search }) {
  await requireStudioSession()
  const sp = await searchParams
  const channel = one(sp.channel)
  const flagged = one(sp.flagged)
  return (
    <LogsView
      initial={{
        channel: CHANNELS.includes(channel as Channel) ? (channel as Channel) : '',
        flagged: flagged === '1' || flagged === 'true',
        q: one(sp.q),
        key: one(sp.key),
        page: Math.max(1, Number(one(sp.page)) || 1),
        open: one(sp.open) || null,
      }}
    />
  )
}
