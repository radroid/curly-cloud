'use client'

import Image from 'next/image'
import { useSite } from './site-context'

// C18 Mobile dock. P2 replaces this Ask button with the dock and menu (REDESIGN-PLAN.md §2).

export function Dock() {
  const { sheetOpen, setSheetOpen } = useSite()
  return (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      inert={sheetOpen}
      className={`fixed bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-full bg-forest pl-2 pr-4 text-sm font-medium text-paper shadow-[0_8px_24px_-6px_rgb(16_58_53/0.55)] transition-transform lg:hidden print:hidden ${sheetOpen ? 'translate-y-24' : ''}`}
    >
      <Image src="/raj-avatar.webp" alt="" width={32} height={32} className="size-8 rounded-full" />
      Ask Raj
    </button>
  )
}
