import type { Metadata } from 'next'
import { KeysView } from '@/app/studio/(app)/keys/keys-view'
import { requireStudioSession } from '@/lib/studio/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Keys' }

export default async function KeysPage() {
  await requireStudioSession()
  return <KeysView />
}
