import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// The studio shows private text after login: never prerender, never index.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Studio', template: '%s · Studio' },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default function StudioRootLayout({ children }: { children: ReactNode }) {
  return children
}
