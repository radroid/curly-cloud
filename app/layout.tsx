import './global.css'
import type { Metadata } from 'next'
import { Antic, JetBrains_Mono } from 'next/font/google'
import { Navbar } from './components/nav'
import { ThemeSwitcher } from './components/theme-switcher'

import Footer from './components/footer'
import { ThemeProvider } from './components/theme-provider'
import { LazyClockWrapper, LazyMouseFollowingEyes, LazyCalFloatingButton } from './components/lazy-components'
import { baseUrl } from './sitemap'

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Generalist Builder | Engineering + Product + Businesses',
    template: '%s | Generalist Builder',
  },
  description: 'I build experiences—both digital and physical. Engineering background. Founder at ARK Expereinces.',
  icons: {
    icon: '/raj-avatar.webp',
    apple: '/raj-avatar.webp',
  },
  openGraph: {
    title: 'Generalist Builder | Engineering + Product + Businesses',
    description: 'I build experiences—both digital and physical. Engineering background. Founder at ARK Expereinces.',
    url: baseUrl,
    siteName: 'Generalist Builder',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const antic = Antic({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-antic',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const cx = (...classes) => classes.filter(Boolean).join(' ')

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={cx(antic.variable, jetbrainsMono.variable)}
    >
      <body className="antialiased min-h-screen transition-colors duration-300">
        <ThemeProvider />
        <Navbar />
        <LazyClockWrapper />
        <LazyCalFloatingButton />
        <ThemeSwitcher />
        <main className="flex-auto min-w-0 flex flex-col">
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-36 sm:pt-44 pb-4 sm:pb-8">
            {children}
            <Footer />
          </div>
        </main>
        <LazyMouseFollowingEyes />
      </body>
    </html>
  )
}
