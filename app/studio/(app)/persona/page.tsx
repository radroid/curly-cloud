import type { Metadata } from 'next'
import { PersonaView } from '@/app/studio/(app)/persona/persona-view'
import { requireStudioSession } from '@/lib/studio/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Persona' }

export default async function PersonaPage() {
  await requireStudioSession()
  return <PersonaView />
}
