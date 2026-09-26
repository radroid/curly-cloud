import './global.css'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'

const baseUrl = 'https://curlycloud.dev'
const TITLE = 'Raj Dholakia — AI Engineer'
const DESCRIPTION =
  'Raj Dholakia builds LLM features that make it past the demo: MCP servers, RAG pipelines, agents, and the evals and guardrails around them. Ask his AI clone, or connect your agent over MCP.'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: TITLE, template: '%s — Raj Dholakia' },
  description: DESCRIPTION,
  icons: { icon: '/raj-avatar.webp', apple: '/raj-avatar.webp' },
  alternates: { canonical: baseUrl },
  openGraph: { title: TITLE, description: DESCRIPTION, url: baseUrl, siteName: 'curlycloud.dev', locale: 'en_US', type: 'profile' },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = { themeColor: '#f5f7f5', colorScheme: 'light' }

const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
