import type { Metadata } from 'next'
import { LogsView } from '@/app/studio/(app)/logs/logs-view'
import { getAppEnv } from '@/lib/env'
import type { Channel } from '@/lib/rag/types'
import { listLogs } from '@/lib/studio/logs'
import { requireStudioSession } from '@/lib/studio/session'
import { CHANNELS, LOGS_PAGE_SIZE } from '@/lib/studio/shared'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conversations' }

type Search = Promise<Record<string, string | string[] | undefined>>

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function LogsPage({ searchParams }: { searchParams: Search }) {
  await requireStudioSession()
  const sp = await searchParams
  const channelParam = one(sp.channel)
  const channel = CHANNELS.includes(channelParam as Channel) ? (channelParam as Channel) : ''
  const flagged = one(sp.flagged) === '1' || one(sp.flagged) === 'true'
  const q = one(sp.q)
  const key = one(sp.key)
  const page = Math.max(1, Number(one(sp.page)) || 1)

  // First page straight from D1 so the list paints with the HTML.
  const env = await getAppEnv()
  const initialData = await listLogs(env.DB, {
    channel: channel || undefined,
    flagged: flagged ? true : undefined,
    q: q.trim() || undefined,
    keyId: key || undefined,
    limit: LOGS_PAGE_SIZE,
    offset: (page - 1) * LOGS_PAGE_SIZE,
  })

  return <LogsView initial={{ channel, flagged, q, key, page, open: one(sp.open) || null }} initialData={initialData} />
}
