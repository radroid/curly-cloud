'use client'

import { RESUME } from '@/content/resume'
import { useSite } from './site-context'

// C2 Hero. P1 replaces this with the curly-cloud stage (REDESIGN-PLAN.md §2).

export function Hero() {
  const { focusAsk } = useSite()
  const current = RESUME.experience.find((r) => r.end === null)
  const linkedin = RESUME.links.find((l) => l.label === 'LinkedIn')
  const github = RESUME.links.find((l) => l.label === 'GitHub')
  return (
    <section id="home" aria-labelledby="hero-name" className="mx-auto max-w-[880px] px-4 pb-10 pt-10 sm:px-6 sm:pt-16 lg:px-10">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-forest">AI Engineer · {RESUME.location}</p>
      <h1 id="hero-name" className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
        {RESUME.name}
      </h1>
      <p className="mt-5 max-w-[34ch] text-2xl leading-snug tracking-tight text-ink/90 sm:text-[1.9rem]">{RESUME.pitch}</p>
      {current && (
        <p className="mt-6 flex items-start gap-2.5 text-[0.95rem] text-muted">
          <span aria-hidden className="relative mt-[0.45rem] flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-forest opacity-40 still:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-forest" />
          </span>
          <span>
            Now: <span className="text-ink">{current.role}</span> at <span className="text-ink">{current.company}</span>. {RESUME.headline}
          </span>
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-2.5 print:hidden">
        <button
          type="button"
          onClick={focusAsk}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[0.95rem] font-medium text-paper transition-colors hover:bg-pine"
        >
          Ask my AI clone
          <kbd className="hidden rounded border border-paper/30 px-1.5 font-mono text-xs text-paper/80 sm:inline">/</kbd>
        </button>
        <a href="#fit" className="inline-flex h-11 items-center rounded-full border border-ink/20 bg-white px-5 text-[0.95rem] font-medium hover:border-ink">
          Check my fit for a role
        </a>
        <a href="#agents" className="inline-flex h-11 items-center rounded-full px-4 text-[0.95rem] font-medium text-forest hover:bg-white">
          Connect your agent
        </a>
      </div>
      <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <li>
          <a href={`mailto:${RESUME.email}`} className="hover:text-ink">
            {RESUME.email}
          </a>
        </li>
        {linkedin && (
          <li>
            <a href={linkedin.href} className="hover:text-ink" rel="me noopener" target="_blank">
              LinkedIn
            </a>
          </li>
        )}
        {github && (
          <li>
            <a href={github.href} className="hover:text-ink" rel="me noopener" target="_blank">
              GitHub
            </a>
          </li>
        )}
        <li className="print:hidden">
          <button type="button" onClick={() => window.print()} className="hover:text-ink">
            Save as PDF
          </button>
        </li>
      </ul>
    </section>
  )
}
