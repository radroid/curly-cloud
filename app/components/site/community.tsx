'use client'

import { RESUME, resumeAnchor, type ResumeRole } from '@/content/resume'
import { LinesBox } from './builds'

// C10 Community: each block is a ticket. The ticket keeps the block's anchor and opens its lines
// when a citation or deep link lands on it (data-opens); the lines keep their own anchors.

/** What a ticket shows beyond the block itself, each taken from its blurb or lines (community.test.ts). */
export const TICKETS: Record<string, { stub: string; events: string[]; platform: string[] }> = {
  'open-invite': {
    stub: 'Open to everyone',
    events: ['Cake Picnic', 'Sip & Bedazzle'],
    platform: ['Next.js', 'Cloudflare Workers', 'D1', 'Stripe Checkout', 'Google Wallet'],
  },
}

// The stub's width; the perforation and its notches sit on its left edge.
const STUB = 'right-[200px]'

function Ticket({ c }: { c: ResumeRole }) {
  const anchor = resumeAnchor('community', c.id)
  const linesId = `lines-${c.id}`
  const extra = TICKETS[c.id]
  return (
    <article id={anchor} data-opens={linesId} className="relative grid scroll-mt-24 rounded-[20px] bg-marker text-ink @min-[640px]:grid-cols-[minmax(0,1fr)_200px]">
      {/* Notches cut into the perforation: discs in the page colour. */}
      <span aria-hidden className={`absolute -top-4 ${STUB} hidden size-8 translate-x-1/2 rounded-full bg-paper @min-[640px]:block print:hidden`} />
      <span aria-hidden className={`absolute -bottom-4 ${STUB} hidden size-8 translate-x-1/2 rounded-full bg-paper @min-[640px]:block print:hidden`} />
      <div className="min-w-0 px-7 pt-[26px]">
        <p className="font-mono text-[12.5px] text-muted">
          {c.period}, {c.location}
        </p>
        <h4 className="type-display mb-1 mt-2 text-[clamp(44px,7cqi,72px)]">{c.company}</h4>
        <p className="mb-[18px] text-ink/80">{c.role}</p>
        {extra && (
          <>
            <ul className="mb-4 flex flex-wrap gap-2" aria-label="Events">
              {extra.events.map((e) => (
                <li key={e} className="rounded-full bg-white px-3.5 py-2 text-[15px] font-semibold">
                  {e}
                </li>
              ))}
            </ul>
            <ul className="mb-3.5 flex flex-wrap gap-1.5 font-mono text-xs text-ink/80" aria-label="Platform">
              {extra.platform.map((p) => (
                <li key={p} className="rounded border border-ink/25 px-[7px] py-[3px]">
                  {p}
                </li>
              ))}
            </ul>
          </>
        )}
        <LinesBox group={anchor} id={linesId} tone="border-ink/20 text-ink/80">
          {c.blurb && <p className="mb-2.5 max-w-[62ch] text-[0.95rem] leading-relaxed text-ink/80">{c.blurb}</p>}
        </LinesBox>
      </div>
      <div className="grid content-between gap-[18px] border-t-2 border-dashed border-ink/35 px-7 pb-4 pt-[26px] @min-[640px]:border-l-2 @min-[640px]:px-[22px] @min-[640px]:border-t-0">
        {extra && <span className="type-display text-[34px] text-forest">{extra.stub}</span>}
        {c.url && (
          <a
            href={c.url}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center justify-self-start text-sm font-medium underline decoration-current/45 decoration-1 underline-offset-4 hover:decoration-current"
          >
            {c.url.replace(/^https?:\/\//, '')} ↗
          </a>
        )}
      </div>
    </article>
  )
}

export function Community() {
  return (
    <div>
      <h3 className="type-display mb-4 mt-14 text-[32px]">Community</h3>
      {RESUME.community.map((c) => (
        <Ticket key={c.id} c={c} />
      ))}
    </div>
  )
}
