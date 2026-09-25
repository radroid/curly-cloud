import type { ReactNode } from 'react'
import { StudioNav } from '@/app/studio/_components/nav'
import { requireStudioSession } from '@/lib/studio/session'

export const dynamic = 'force-dynamic'

/** Server guard for everything under /studio except /studio/login. Pages re-check (see session.ts). */
export default async function StudioAppLayout({ children }: { children: ReactNode }) {
  await requireStudioSession()
  return (
    <div className="min-h-dvh bg-paper text-ink md:grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <StudioNav />
      <main className="mx-auto w-full min-w-0 max-w-[84rem] px-4 pb-20 pt-5 md:px-8 md:pt-8">{children}</main>
    </div>
  )
}
