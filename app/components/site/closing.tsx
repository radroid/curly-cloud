'use client'

import Link from 'next/link'
import { useState } from 'react'
import { RESUME, resumeAnchor } from '@/content/resume'
import { MOTION_TIERS, type MotionTier } from '@/app/lib/motion'
import { useInView } from '@/app/lib/use-in-view'
import { useLocalTime } from '@/app/lib/use-local-time'
import { useMagnetic } from '@/app/lib/use-magnetic'
import { useMotionTier } from '@/app/lib/use-motion-tier'
import { useSite } from './site-context'

// The labels are short forms of the bodies; both must stay true to CLONE-PLAN.md.
const PIPELINE: { step: string; label: string; body: string }[] = [
  {
    step: 'Know',
    label: 'resume + my own answers',
    body: 'Public: every line of this resume. Private: my own answers to interview questions about principles, decisions and stories, written offline in a HyperCard-style stack. Those answers stay on the server.',
  },
  {
    step: 'Find',
    label: 'bm25 + bge-m3, fused, reranked',
    body: 'SQLite FTS5 (BM25) and bge-m3 embeddings search in parallel, fused with Reciprocal Rank Fusion, then reranked.',
  },
  {
    step: 'Answer',
    label: 'first person, numbered sources',
    body: 'The model answers as me, only from the numbered sources, and says so when they don’t cover a question. Retrieved text is treated as data, never as instructions.',
  },
  {
    step: 'Guard',
    label: 'checked while it streams',
    body: 'Citations are validated on the server. A streaming guard cuts the answer if it starts reproducing my private notes word for word. Rate limits and a daily token budget cap the cost.',
  },
  {
    step: 'Measure',
    label: 'evals before changes ship',
    body: 'A golden set scores retrieval (hit@k, MRR) and answers, plus refusal and prompt-injection probes.',
  },
]

const stageLink =
  'inline-flex min-h-11 items-center font-medium text-term-text underline decoration-current/45 decoration-1 underline-offset-4 transition-colors hover:decoration-current print:text-ink'

/**
 * C14. The answer pipeline as five numbered steps on the stage. A step opens its full sentence in
 * the detail line below; a packet runs Know → Measure three times once the pipeline is in view
 * (wide layouts only), then rests on Measure. With motion off it's drawn there from the start.
 */
export function HowItWorks() {
  const [open, setOpen] = useState(0)
  const [pipeRef, inView] = useInView<HTMLDivElement>({ once: true, threshold: 0.5 })
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="-mx-gutter mt-[clamp(72px,10vh,120px)] scroll-mt-14 bg-night px-gutter py-[clamp(56px,9vh,96px)] text-term-text print:bg-transparent print:text-ink"
    >
      <h2 id="how-title" className="type-display mb-10 max-w-[12ch] text-[clamp(48px,8cqi,96px)]">
        How the clone answers
      </h2>
      <div ref={pipeRef} className="relative">
        <ol className="grid gap-[18px] @min-[760px]:grid-cols-5 @min-[760px]:gap-0">
          {PIPELINE.map((p, i) => (
            <li
              key={p.step}
              // The rail: a segment from this step's dot to the next one, down on narrow layouts, across on wide ones.
              className="relative before:absolute before:-bottom-7 before:left-[9px] before:top-2.5 before:w-0.5 before:bg-term-text/20 last:before:hidden @min-[760px]:before:bottom-auto @min-[760px]:before:left-2.5 @min-[760px]:before:top-[9px] @min-[760px]:before:h-0.5 @min-[760px]:before:w-full"
            >
              <button
                type="button"
                aria-expanded={open === i}
                aria-controls="how-detail"
                onClick={() => setOpen(i)}
                className="group relative block w-full rounded-md pl-[30px] text-left before:absolute before:left-[3px] before:top-[3px] before:size-3.5 before:rounded-full before:border-2 before:border-term-accent before:bg-night before:transition-colors aria-expanded:before:bg-term-accent @min-[760px]:pl-0 @min-[760px]:pr-4 @min-[760px]:pt-9"
              >
                <span className="block font-mono text-xs text-term-dim print:text-muted">{String(i + 1).padStart(2, '0')}</span>
                <span className="type-display mt-1.5 block text-[clamp(28px,3.6cqi,40px)] transition-colors group-hover:text-term-accent">{p.step}</span>
                <span className="mt-2 block font-mono text-[12.5px] leading-normal text-term-dim print:text-muted">{p.label}</span>
                <span className="mt-2 hidden text-sm leading-relaxed print:block">{p.body}</span>
              </button>
            </li>
          ))}
        </ol>
        <span aria-hidden className="pointer-events-none absolute left-1 top-1 hidden h-3 w-[calc(80%+12px)] @min-[760px]:block print:hidden">
          <span
            className={[
              'absolute left-0 top-0 size-3 rounded-full bg-sun shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-sun)_20%,transparent)]',
              inView ? 'animate-travel' : '',
              'still:left-[calc(100%-12px)] still:animate-none',
            ].join(' ')}
          />
        </span>
      </div>
      {/* Every sentence sits in the same grid cell, so opening a step never moves the page. */}
      <div className="mt-7 grid max-w-[62ch] text-[17px] leading-relaxed print:hidden">
        {PIPELINE.map((p) => (
          <p key={p.step} aria-hidden className="invisible col-start-1 row-start-1">
            {p.body}
          </p>
        ))}
        <p id="how-detail" aria-live="polite" className="col-start-1 row-start-1">
          {PIPELINE[open].body}
        </p>
      </div>
      <p className="mt-9 flex flex-wrap items-center gap-x-5 text-term-dim print:hidden">
        <span>Prefer a shell?</span>
        <Link href="/terminal" className={stageLink}>
          Open the terminal
        </Link>
        <Link href="/mac" className={stageLink}>
          Mac ’84
        </Link>
      </p>
    </section>
  )
}

/**
 * C15. The stage's closing band, overlapping How by a pixel so no seam shows between them.
 * `#r-contact` wraps it all, so a citation of the contact source lands here; its flash is a coral
 * ring over a faint sun tint, which reads on the dark stage.
 */
export function Contact() {
  const { focusAsk } = useSite()
  const time = useLocalTime()
  const magnetic = useMagnetic<HTMLAnchorElement>()
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="-mx-gutter -mt-px scroll-mt-14 bg-night px-gutter py-[clamp(56px,10vh,120px)] text-term-text print:bg-transparent print:py-6 print:text-ink"
    >
      <div
        id={resumeAnchor('contact')}
        className="-m-4 scroll-mt-24 rounded-xl p-4 transition-shadow duration-700 data-flash:animate-none data-flash:shadow-[0_0_0_2px_var(--color-coral),inset_0_0_0_999px_color-mix(in_srgb,var(--color-sun)_18%,transparent)]"
      >
        <h2 id="contact-title" className="type-display text-[clamp(min(88px,26cqi),19cqi,260px)] leading-[0.82] print:text-5xl">
          Say hello
        </h2>
        <div className="mt-9 flex flex-wrap items-center gap-x-[22px] gap-y-3.5">
          <a
            ref={magnetic}
            href={`mailto:${RESUME.email}`}
            className="inline-flex h-[60px] max-w-full items-center rounded-full bg-term-accent px-[26px] font-mono text-[clamp(16px,2.2cqi,22px)] font-medium text-pine transition-[translate,background-color] duration-200 hover:bg-term-text print:h-auto print:px-0"
          >
            <span className="truncate">{RESUME.email}</span>
          </a>
          <div className="flex flex-wrap gap-x-[18px] print:hidden">
            {RESUME.links
              .filter((l) => !l.href.includes('curlycloud.dev'))
              .map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="me noopener" className={stageLink}>
                  {l.label}
                </a>
              ))}
            <button type="button" onClick={focusAsk} className={stageLink}>
              Ask the clone first
            </button>
          </div>
        </div>
        <p className="mt-7 font-mono text-[13px] text-term-dim print:text-muted">
          {RESUME.location.split(',')[0]}
          <span className="print:hidden">
            , <span className="inline-block min-w-[10ch] tabular-nums">{time ?? '--:--'}</span>
          </span>
        </p>
      </div>
    </section>
  )
}

/** C16. The privacy note stays visible and word for word (CLONE-PLAN); the render select sets the tier. */
export function Footer() {
  const { tier, setTier } = useMotionTier()
  const link = 'inline-flex min-h-11 items-center underline decoration-current/45 decoration-1 underline-offset-4 transition-colors hover:text-ink hover:decoration-current'
  return (
    <footer className="pt-9 text-sm text-muted">
      <div id="privacy" className="max-w-[64ch] scroll-mt-24 space-y-2">
        <p className="font-medium text-ink">About the clone and your privacy</p>
        <p>
          “Ask Raj” is an AI that answers from my resume and my own written answers. It can be wrong, and it’s no substitute for talking to me.
          Questions and answers are logged so I can correct it. Logs keep a hashed visitor id that changes daily — never your IP address — and
          email addresses or phone numbers in questions are redacted.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5">
        <span className="inline-flex min-h-11 items-center">
          © {new Date().getFullYear()} {RESUME.name}
        </span>
        <Link href="/terminal" className={link}>
          Terminal
        </Link>
        <Link href="/mac" className={link}>
          Mac ’84
        </Link>
        <a href="/llms.txt" className={link}>
          llms.txt
        </a>
        <a href="#agents" className={link}>
          MCP
        </a>
        <button type="button" onClick={() => window.print()} className={`${link} print:hidden`}>
          Save as PDF
        </button>
        <label className="inline-flex min-h-11 items-center gap-2 print:hidden">
          Render quality
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as MotionTier)}
            className="h-9 rounded-md border border-rule bg-white px-1.5 text-[13px] text-ink pointer-coarse:h-11"
          >
            {MOTION_TIERS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </footer>
  )
}
