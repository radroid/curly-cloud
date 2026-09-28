'use client'

import { useEffect, useRef, useState } from 'react'
import { RESUME, resumeAnchor } from '@/content/resume'
import { FILTERS, FILTER_LABELS, TAG_COUNTS, nLines } from './resume-helpers'
import { useSite, useSkillHover } from './site-context'

// C6 Skill lens (REDESIGN-PLAN.md §2). Hovering or focusing a chip lights up the lines, role rows
// and timeline ticks that use the skill; clicking one filters. The full CV list keeps id="r-skills".

const GROUPS = FILTERS.map((g) => ({ ...g, items: g.items.filter((i) => TAG_COUNTS[i.id]) })).filter((g) => g.items.length)

/** "Showing 4 lines about TypeScript". */
function showing(skill: string): string {
  return `Showing ${nLines(TAG_COUNTS[skill] ?? 0)} about ${FILTER_LABELS[skill] ?? skill}`
}

export function SkillLens(): React.ReactNode {
  const { skill, setSkill } = useSite()
  const [hover, setHover] = useSkillHover()

  const chipFor = (id: string): HTMLButtonElement | null => document.querySelector(`[data-skill="${id}"]`)
  const skillOf = (target: EventTarget): string | null => (target instanceof Element ? (target.closest<HTMLElement>('[data-skill]')?.dataset.skill ?? null) : null)

  return (
    <div id={resumeAnchor('skills')} data-opens="skills-full" className="scroll-mt-[90px] rounded-lg">
      <p className="mb-4 text-[15px] text-muted">
        <span className="pointer-coarse:hidden">Hover a skill to light up the lines that use it. Click one to filter.</span>
        <span className="hidden pointer-coarse:inline">Tap a skill to show only the lines that use it.</span>
      </p>
      <div
        className="grid gap-x-8 gap-y-[22px] @min-[481px]:grid-cols-2 @min-[761px]:grid-cols-3"
        // One handler for the whole lens, so moving between chips doesn't flicker the lines. Mouse
        // only: touch gets no hover state, it taps straight to the filter.
        onPointerOver={(e) => {
          const id = e.pointerType === 'mouse' ? skillOf(e.target) : null
          if (id && id !== hover) setHover(id)
        }}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
        onFocus={(e) => {
          if (e.target.matches(':focus-visible')) setHover(skillOf(e.target))
        }}
        onBlur={() => setHover(null)}
      >
        {GROUPS.map((g) => (
          <div key={g.group} role="group" aria-labelledby={`skills-${g.group}`}>
            <h3 id={`skills-${g.group}`} className="mb-2 text-[13px] font-semibold text-muted">
              {g.group}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((i) => {
                const on = skill === i.id
                return (
                  <button
                    key={i.id}
                    type="button"
                    data-skill={i.id}
                    aria-pressed={on}
                    onClick={() => setSkill(on ? null : i.id)}
                    className={[
                      'inline-flex min-h-[34px] items-center gap-2 rounded-full border py-[5px] pl-3 pr-2.5 text-sm transition-colors duration-200 pointer-coarse:min-h-11',
                      on ? 'border-forest bg-forest text-paper' : hover === i.id ? 'border-forest bg-white' : 'border-rule bg-white hover:border-forest',
                    ].join(' ')}
                  >
                    {/* The name is the visible text plus "lines", so voice control can say what it sees. */}
                    {i.label}{' '}
                    <span className={`font-mono text-[11px] tabular-nums ${on ? 'text-paper/75' : 'text-muted'}`}>
                      {TAG_COUNTS[i.id]}
                      <span className="sr-only">{TAG_COUNTS[i.id] === 1 ? ' line' : ' lines'}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* suppressHydrationWarning: a #r-… deep link can open it before React hydrates. */}
      <details id="skills-full" className="disclose group/list" suppressHydrationWarning>
        <summary className="mt-3 inline-flex min-h-11 items-center gap-2.5 text-sm text-muted hover:text-ink">
          <Chevron group="list" />
          Full skill list
        </summary>
        <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-[18px] gap-y-1.5 text-sm">
          {RESUME.skills.map((g) => (
            <div key={g.id} className="contents">
              <dt className="font-semibold">{g.label}</dt>
              <dd className="text-muted">{g.items.map((i) => i.label).join('; ')}</dd>
            </div>
          ))}
        </dl>
      </details>

      <FilterPill
        skill={skill}
        onClear={(fromKeyboard) => {
          setSkill(null)
          // From the keyboard, focus goes back to the chip, without scrolling back up to it.
          if (fromKeyboard && skill) chipFor(skill)?.focus({ preventScroll: true })
        }}
      />
    </div>
  )
}

/** A disclosure chevron: points right when closed, down when its <details> (named group) is open. */
export function Chevron({ group }: { group: 'list' | 'row' }): React.ReactNode {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 -rotate-45 border-b-2 border-r-2 border-current opacity-60 transition-transform duration-[250ms] ${group === 'row' ? 'group-open/row:rotate-45' : 'group-open/list:rotate-45'}`}
    />
  )
}

/**
 * "Showing N lines about X · Clear", fixed under the top bar and centred on the reading column
 * (left of the 400/440 px Ask panel on desktop) while a filter is on, plus a polite live region.
 */
function FilterPill({ skill, onClear }: { skill: string | null; onClear: (fromKeyboard: boolean) => void }): React.ReactNode {
  const [said, setSaid] = useState('')
  const had = useRef(false)
  useEffect(() => {
    if (skill) setSaid(`${showing(skill)}.`)
    else if (had.current) setSaid('Filter cleared. Showing all lines.')
    had.current = skill !== null
  }, [skill])

  return (
    <>
      {skill && (
        <div className="fixed left-1/2 top-[68px] z-30 flex w-max max-w-[calc(100%-2*var(--spacing-gutter))] -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-sm text-paper shadow-[0_12px_32px_-10px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.12)] transition-[opacity,translate] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] starting:-translate-y-1.5 starting:opacity-0 lg:left-[calc(50%-200px)] lg:max-w-[calc(100%-400px-2*var(--spacing-gutter))] xl:left-[calc(50%-220px)] xl:max-w-[calc(100%-440px-2*var(--spacing-gutter))] still:transition-none print:hidden">
          <span className="min-w-0">{showing(skill)}</span>
          <button
            type="button"
            onClick={(e) => onClear(e.detail === 0)}
            aria-label={`Clear the ${FILTER_LABELS[skill] ?? skill} filter`}
            // The pill is 44 px tall; the hit area fills it.
            className="relative shrink-0 rounded-full bg-paper px-3 py-1.5 text-[13px] text-ink before:absolute before:-inset-2 hover:bg-white"
          >
            Clear
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </>
  )
}
