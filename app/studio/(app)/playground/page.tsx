import type { Metadata } from 'next'
import { PlaygroundView } from '@/app/studio/(app)/playground/playground-view'
import { requireStudioSession } from '@/lib/studio/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Playground' }

export default async function PlaygroundPage() {
  await requireStudioSession()
  return <PlaygroundView />
}
