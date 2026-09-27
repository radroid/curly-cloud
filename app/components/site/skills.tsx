'use client'

import { RESUME, resumeAnchor } from '@/content/resume'
import { FILTERS, FILTER_LABELS, TAG_COUNTS } from './resume-helpers'
import { useSite } from './site-context'

// C6 Skill lens. P3 replaces this with the chip lens, floating filter pill and full skill list
// (REDESIGN-PLAN.md §2). The full list keeps id="r-skills".

function SkillFilter() {
  const { skill, setSkill } = useSite()
  const count = skill ? (TAG_COUNTS[skill] ?? 0) : 0
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-8 border-b border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 print:hidden">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-xs font-medium text-muted">
          <span className="sm:hidden">Skill</span>
          <span className="max-sm:hidden">Filter by skill</span>
        </p>
        <div className="-my-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1 pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none]">
          {FILTERS.flatMap((g) => g.items)
            .filter((i) => TAG_COUNTS[i.id])
            .map((i) => {
              const on = skill === i.id
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSkill(on ? null : i.id)}
                  className={[
                    'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    on ? 'border-forest bg-forest text-paper' : 'border-rule bg-white text-ink hover:border-forest',
                  ].join(' ')}
                >
                  {i.label}
                  <span className={`font-mono tabular-nums ${on ? 'text-paper/70' : 'text-muted'}`}>{TAG_COUNTS[i.id]}</span>
                </button>
              )
            })}
        </div>
      </div>
      {skill && (
        <p className="mt-2 text-xs text-muted" role="status">
          Showing {count} line{count === 1 ? '' : 's'} about <span className="font-medium text-ink">{FILTER_LABELS[skill]}</span>.{' '}
          <button type="button" onClick={() => setSkill(null)} className="font-medium text-forest underline underline-offset-2">
            Clear
          </button>
        </p>
      )}
    </div>
  )
}

export function SkillLens() {
  const { setSkill } = useSite()
  const pick = (id: string) => {
    setSkill(id)
    document.getElementById('work-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <>
      <SkillFilter />
      <div id={resumeAnchor('skills')} className="mb-12 scroll-mt-24 rounded-md">
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {RESUME.skills.map((g) => (
            <div key={g.id}>
              <h3 className="text-sm font-semibold">{g.label}</h3>
              <ul className="mt-2 space-y-1 text-[0.95rem] text-muted">
                {g.items.map((i) => (
                  <li key={i.id}>
                    {TAG_COUNTS[i.id] ? (
                      <button type="button" onClick={() => pick(i.id)} className="text-left hover:text-forest hover:underline hover:underline-offset-2">
                        {i.label}
                        <span className="ml-1.5 font-mono text-xs text-muted/80">{TAG_COUNTS[i.id]}</span>
                      </button>
                    ) : (
                      i.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
