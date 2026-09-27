'use client'

import { RESUME, resumeAnchor } from '@/content/resume'
import { Lines } from './resume'
import { dimmedBy } from './resume-helpers'
import { useSite } from './site-context'

// C8 Role rows and C11 Study. P3 turns the roles into collapsed <details class="disclose"> rows
// and the study list into a compact strip (REDESIGN-PLAN.md §2). Anchors stay on the same elements.

export function Roles() {
  const { skill } = useSite()
  return (
    <ol id="roles" className="mb-16">
      {RESUME.experience.map((r, i) => {
        const anchor = resumeAnchor('exp', r.id)
        const faded = dimmedBy(skill, anchor) ? 'opacity-40' : ''
        return (
          <li
            key={r.id}
            id={anchor}
            className={`grid scroll-mt-32 gap-x-8 gap-y-2 rounded-md py-7 sm:grid-cols-[8.5rem_minmax(0,1fr)] ${i ? 'border-t border-rule' : 'pt-1'}`}
          >
            <div className={`font-mono text-xs leading-relaxed text-muted transition-opacity ${faded}`}>
              <p className="text-ink">{r.period}</p>
              <p>{r.location}</p>
              {r.end === null && <p className="mt-1.5 inline-block rounded-full bg-forest px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-paper">Now</p>}
            </div>
            <div className="min-w-0">
              <h3 className={`text-lg font-semibold leading-snug tracking-tight transition-opacity ${faded}`}>{r.role}</h3>
              <p className="text-[0.95rem] text-forest">{r.company}</p>
              {r.blurb && <p className="mt-2 max-w-[62ch] text-[0.95rem] leading-relaxed text-muted">{r.blurb}</p>}
              <div className="mt-3">
                <Lines group={anchor} />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Study() {
  return (
    <div className="mt-14">
      <h3 className="type-display mb-4 text-[32px]">Study</h3>
      <ul id={resumeAnchor('education')} className="scroll-mt-24 divide-y divide-rule rounded-md">
        {RESUME.education.map((e) => (
          <li key={e.id} className="grid gap-x-8 gap-y-0.5 py-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
            <span className="font-mono text-xs leading-6 text-muted">{e.period}</span>
            <span>
              <span className="font-medium">{e.credential}</span>
              <span className="text-muted"> · {e.school}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
