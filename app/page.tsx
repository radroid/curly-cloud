import { RESUME } from '@/content/resume'
import { AgentsSection } from '@/app/components/site/agents-section'
import { AskPanel } from '@/app/components/site/ask-panel'
import { AskFab, Contact, Footer, HowItWorks } from '@/app/components/site/closing'
import { FitCheck } from '@/app/components/site/fit-check'
import { About, Education, Hero, HowToRead, Skills, Work } from '@/app/components/site/resume'
import { SiteProvider } from '@/app/components/site/site-context'
import { TopBar } from '@/app/components/site/top-bar'

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

export default function Home() {
  return (
    <SiteProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <TopBar />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <main id="main" className="mx-auto w-full min-w-0 max-w-[880px] px-4 sm:px-6 lg:px-10">
          <Hero />
          <HowToRead />
          <About />
          <Work />
          <Skills />
          <Education />
          <FitCheck />
          <AgentsSection />
          <HowItWorks />
          <Contact />
          <Footer />
        </main>
        <aside className="lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] print:hidden">
          <AskPanel />
        </aside>
      </div>
      <AskFab />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, '\\u003c') }} />
    </SiteProvider>
  )
}
