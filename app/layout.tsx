import './global.css'
import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'

const baseUrl = 'https://curlycloud.dev'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: 'curlycloud',
  description: 'Coming soon — curlycloud.dev',
  icons: {
    icon: '/raj-avatar.webp',
    apple: '/raj-avatar.webp',
  },
  other: {
    'color-scheme': 'light',
    'theme-color': '#a8a8a8',
  },
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: 'curlycloud',
    description: 'Coming soon — curlycloud.dev',
    url: baseUrl,
    siteName: 'curlycloud',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-8 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded focus:text-sm"
          style={{ backgroundColor: '#fff', color: '#000', border: '2px solid #000' }}
        >
          Skip to content
        </a>
        <noscript>
          <div style={{ fontFamily: "'Chicago', monospace", textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ fontSize: 16, fontWeight: 'bold' }}>Welcome to curlycloud.dev</p>
            <p style={{ fontSize: 13, color: '#555', marginTop: 8 }}>Coming soon. Enable JavaScript for the full experience.</p>
          </div>
        </noscript>
        <main id="main-content">
          {children}
        </main>
      </body>
    </html>
  )
}
