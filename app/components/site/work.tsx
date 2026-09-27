'use client'

import { useEffect, useRef, useState } from 'react'
import { RESUME, resumeAnchor, type ResumeRole } from '@/content/resume'
import { Lines } from './resume'
import { FILTER_LABELS, citedIn, dimmedBy, matchesIn, nLines } from './resume-helpers'
import { useSite, useSkillHover } from './site-context'
import { Chevron } from './skills'

// C8 Role rows and C11 Study (REDESIGN-PLAN.md §2). Each role is an uncontrolled
// <details class="disclose"> carrying its citation anchor, so citations, find-in-page and print
// can open it; React never sets `open`.

/** One headline number per role, quoted from its lines (work.test.ts checks every number). */
export const HEADLINE: Record<string, string> = {
  eddy: '150,000+ devices',
  'create-club': '80+ processes automated',
  pinhous: '15 → 2 min deploys',
  aro: '20% fewer repeat incidents',
  duit: '15 s → 5 s signals',
}

/** The role's most used skill tags, most frequent first (ties keep line order). */
export function topTags(role: ResumeRole, n = 3): string[] {
  const counts = new Map<string, number>()
  for (const b of role.bullets) for (const t of b.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => FILTER_LABELS[t] ?? t)
}

/** "Create Club (via Acme)" → ["Create Club", "via Acme"]: the aside moves to the role line. */
function splitCompany(company: string): [string, string | null] {
  const m = /^(.*?) \((.*)\)$/.exec(company)
  return m ? [m[1], m[2]] : [company, null]
}

const ROLE_LINES = RESUME.experience.reduce((n, r) => n + r.bullets.length, 0)

export function Roles(): React.ReactNode {
  const { skill } = useSite()
  const list = useRef<HTMLOListElement>(null)
  const [allOpen, setAllOpen] = useState(false)

  const rows = (): HTMLDetailsElement[] => [...(list.current?.querySelectorAll<HTMLDetailsElement>(':scope > li > details') ?? [])]
  const sync = () => setAllOpen(rows().every((d) => d.open))

  // A filter opens the roles that have matching lines. It never closes any.
  useEffect(() => {
    if (!skill) return
    for (const d of rows()) if (matchesIn(d.id, skill) > 0) d.open = true
  }, [skill])

  return (
    <>
      <div className="mb-1.5 mt-11 flex items-baseline justify-between gap-4 font-mono text-[13px] text-muted">
        <span>
          {RESUME.experience.length} roles, {nLines(ROLE_LINES)}
        </span>
        <button
          type="button"
          onClick={() => {
            for (const d of rows()) d.open = !allOpen
            sync()
          }}
          className="-my-3 min-h-11 underline decoration-current/45 underline-offset-4 hover:text-ink hover:decoration-current print:hidden"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>
      <ol ref={list} id="roles" className="border-t border-ink">
        {RESUME.experience.map((r) => (
          <li key={r.id}>
            <Role role={r} onToggle={sync} />
          </li>
        ))}
      </ol>
    </>
  )
}

function Role({ role: r, onToggle }: { role: ResumeRole; onToggle: () => void }): React.ReactNode {
  const { skill, cited } = useSite()
  const [hover] = useSkillHover()
  const anchor = resumeAnchor('exp', r.id)
  const [company, aside] = splitCompany(r.company)
  const matches = matchesIn(anchor, hover ?? skill)
  const nCited = citedIn(cited, anchor)
  return (
    // suppressHydrationWarning: on a #r-exp-… deep link the browser opens the row before React hydrates.
    <details
      id={anchor}
      onToggle={onToggle}
      suppressHydrationWarning
      className={`disclose group/row scroll-mt-[90px] border-b border-rule transition-opacity duration-300 ${dimmedBy(skill, anchor) ? 'opacity-[0.38]' : ''}`}
    >
      <summary className="grid grid-cols-[minmax(0,1fr)_18px] items-center gap-x-6 gap-y-1.5 py-[22px] @min-[761px]:grid-cols-[128px_minmax(0,1fr)_auto_18px]">
        <span className="font-mono text-[12.5px] leading-normal text-muted">
          {r.period}
          {r.end === null && (
            <>
              <br />
              <span className="mt-1 inline-block rounded-full bg-forest px-[7px] py-0.5 text-[10.5px] leading-normal text-paper">now</span>
            </>
          )}
        </span>
        <span className="col-start-1 min-w-0 @min-[761px]:col-start-auto">
          <span className="type-display block text-[clamp(30px,4.2cqi,44px)]">{company}</span>
          <span className="mt-1.5 block text-[15px] text-muted">
            {r.role}
            {aside && ` · ${aside}`}
          </span>
        </span>
        <span className="col-start-1 grid justify-items-start gap-2 text-left @min-[761px]:col-start-auto @min-[761px]:justify-items-end @min-[761px]:text-right">
          {HEADLINE[r.id] && (
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold before:size-2 before:shrink-0 before:rounded-full before:bg-sun before:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-sun)_30%,transparent)]">
              {HEADLINE[r.id]}
            </span>
          )}
          <span className="flex flex-wrap gap-1.5 font-mono text-[11px] text-muted @min-[761px]:justify-end">
            {topTags(r).map((t) => (
              <span key={t} className="rounded border border-rule px-1.5 py-0.5">
                {t}
              </span>
            ))}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted @min-[761px]:justify-end">
            {nCited > 0 && (
              <span className="rounded bg-coral-ink px-[7px] py-[3px] text-[11px] font-medium text-white">
                {nCited} cited<span className="sr-only"> in the latest answer</span>
              </span>
            )}
            {matches > 0 && (
              <span className="rounded bg-forest px-[7px] py-[3px] text-[11px] font-medium text-paper">
                {matches} match<span className="sr-only"> for {FILTER_LABELS[hover ?? skill ?? '']}</span>
              </span>
            )}
            <span>{nLines(r.bullets.length)}</span>
          </span>
        </span>
        <span className="col-start-2 row-start-1 justify-self-center text-muted @min-[761px]:col-start-auto @min-[761px]:row-start-auto">
          <Chevron group="row" />
        </span>
      </summary>
      <div className="pb-[26px] @min-[761px]:pl-[152px]">
        {r.blurb && <p className="mb-3 max-w-[62ch] text-base leading-relaxed text-muted">{r.blurb}</p>}
        <Lines group={anchor} />
      </div>
    </details>
  )
}

export function Study(): React.ReactNode {
  return (
    <div>
      <h3 className="type-display mb-[18px] mt-14 text-[32px]">Study</h3>
      <ul id={resumeAnchor('education')} className="grid scroll-mt-[90px] gap-x-8 rounded-md @min-[701px]:grid-cols-3">
        {RESUME.education.map((e) => (
          <li key={e.id} className="border-t border-rule py-3.5">
            <span className="font-mono text-[12.5px] text-muted">{e.period}</span>
            <span className="mt-1.5 block font-semibold leading-snug">{e.credential}</span>
            <span className="block text-sm text-muted">{e.school}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
