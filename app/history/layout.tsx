import { Sora } from 'next/font/google'
import type { Metadata } from 'next'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'History',
  description: 'A timeline of my journey — from Mumbai to Manchester to Toronto. Engineering, startups, and everything in between.',
  alternates: {
    canonical: 'https://curlycloud.dev/history',
  },
  openGraph: {
    title: 'History',
    description: 'A timeline of my journey — from Mumbai to Manchester to Toronto. Engineering, startups, and everything in between.',
    url: 'https://curlycloud.dev/history',
    type: 'website',
  },
}

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <div className={sora.variable}>{children}</div>
}
