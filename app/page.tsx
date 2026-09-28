import type { Viewport } from 'next'
import { Anton } from 'next/font/google'
import { RESUME } from '@/content/resume'
import { AgentsSection } from '@/app/components/site/agents-section'
import { AskPanel } from '@/app/components/site/ask-panel'
import { Boot } from '@/app/components/site/boot'
import { Builds } from '@/app/components/site/builds'
import { Contact, Footer, HowItWorks } from '@/app/components/site/closing'
import { Community } from '@/app/components/site/community'
import { Dock } from '@/app/components/site/dock'
import { FitCheck } from '@/app/components/site/fit-check'
import { FooterBar } from '@/app/components/site/footer-bar'
import { Hero } from '@/app/components/site/hero'
import { Marquee } from '@/app/components/site/marquee'
import { Numbers } from '@/app/components/site/numbers'
import { Profile } from '@/app/components/site/profile'
import { SectionHeading } from '@/app/components/site/resume'
import { SiteProvider } from '@/app/components/site/site-context'
import { SkillLens } from '@/app/components/site/skills'
import { Timeline } from '@/app/components/site/timeline'
import { TopBar } from '@/app/components/site/top-bar'
import { Roles, Study } from '@/app/components/site/work'

// The display face, loaded here rather than in the root layout so /terminal and /mac don't fetch it.
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--font-anton', display: 'swap' })

// The page opens on the dark stage (hero), so mobile browser chrome matches it (--color-night).
export const viewport: Viewport = { themeColor: '#0b2a26', colorScheme: 'light' }

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: RESUME.name,
  jobTitle: 'AI Engineer',
  description: RESUME.pitch,
  email: `mailto:${RESUME.email}`,
  url: 'https://curlycloud.dev',
  address: { '@type': 'PostalAddress', addressLocality: 'Toronto', addressRegion: 'ON', addressCountry: 'CA' },
  sameAs: RESUME.links.filter((l) => !l.href.includes('curlycloud.dev')).map((l) => l.href),
  worksFor: { '@type': 'Organization', name: RESUME.experience[0].company },
  knowsAbout: ['Model Context Protocol', 'Retrieval-augmented generation', 'LLM evaluation', 'AI agents', 'TypeScript', 'Python'],
}

/**
 * The resume page. Component ids (C0–C19) match REDESIGN-PLAN.md §2. The hero and marquee span
 * the full width on desktop; below them the reading column sits beside the sticky Ask panel.
 */
export default function Home() {
  return (
    <SiteProvider>
      <div className={anton.variable}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
          Skip to content
        </a>
        <Boot />
        <TopBar />
        <main id="main" className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="lg:col-span-2">
            <Hero />
            <Marquee />
          </div>
          <div className="@container min-w-0 px-gutter pb-24">
            <Profile />
            <Numbers />
            <section id="work" aria-labelledby="work-title" className="scroll-mt-16 pt-14 sm:pt-24">
              <SectionHeading id="work-title" index={2} title="Work" />
              <SkillLens />
              <Timeline />
              <Roles />
              <Builds />
              <Community />
              <Study />
            </section>
            <FitCheck />
            <AgentsSection />
            <HowItWorks />
            <Contact />
            <Footer />
          </div>
          <div id="ask" className="scroll-mt-14 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:self-start print:hidden">
            <AskPanel />
          </div>
        </main>
        <FooterBar />
        <Dock />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, '\\u003c') }} />
    </SiteProvider>
  )
}
