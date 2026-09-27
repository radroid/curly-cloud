'use client'

import { RESUME, resumeAnchor } from '@/content/resume'
import { Lines } from './resume'

// C10 Community. P5 replaces this with the Open Invite ticket (REDESIGN-PLAN.md §2).
// The block keeps its anchor; its lines keep theirs.

export function Community() {
  return (
    <div>
      <h3 className="type-display mb-4 mt-14 text-[32px]">Community</h3>
      {RESUME.community.map((c) => {
        const anchor = resumeAnchor('community', c.id)
        return (
          <article key={c.id} id={anchor} className="scroll-mt-32 overflow-hidden rounded-2xl border border-rule bg-white">
            <div className="flex flex-wrap items-end justify-between gap-3 bg-marker/60 px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono text-xs text-muted">{c.period}</p>
                <h4 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{c.company}</h4>
                <p className="text-[0.95rem] text-forest">{c.role}</p>
              </div>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-9 items-center rounded-full border border-ink/20 bg-white px-4 text-sm font-medium hover:border-ink"
                >
                  {c.url.replace(/^https?:\/\//, '')} ↗
                </a>
              )}
            </div>
            <div className="p-5 sm:p-6">
              {c.blurb && <p className="max-w-[62ch] text-[0.95rem] leading-relaxed text-muted">{c.blurb}</p>}
              <div className="mt-3">
                <Lines group={anchor} />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
