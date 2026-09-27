'use client'

import type { ResumeBullet } from '@/content/resume'
import { Emphasized, LINES, questionAbout } from './resume-helpers'
import { useSite, useSkillHover } from './site-context'

/**
 * Building blocks shared by the resume sections. Every resume line renders through `Bullet`,
 * which keeps its citation anchor as the element id. The sections live in their own files:
 * hero, profile, numbers, skills, timeline, work, builds, community (see app/page.tsx).
 */

/** Section title in the display face, with its bracketed nav index: `[2] WORK`. */
export function SectionHeading({ id, index, title, meta }: { id: string; index?: number; title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {index !== undefined && (
        <span aria-hidden className="pt-[0.5em] font-mono text-sm text-muted">
          [{index}]
        </span>
      )}
      <h2 id={id} className="type-display scroll-mt-24 text-[clamp(52px,9cqi,104px)]">
        {title}
      </h2>
      {meta && <span className="ml-auto self-end pb-2 font-mono text-xs text-muted">{meta}</span>}
    </div>
  )
}

/**
 * One citable resume line. Matching the hovered or filtered skill gives it a full border;
 * the filter dims the rest; a citation in the latest answer marks it and shows its numbers.
 */
export function Bullet({ anchor, bullet }: { anchor: string; bullet: ResumeBullet }) {
  const { skill, cited, ask } = useSite()
  const [hover] = useSkillHover()
  const nums = cited[anchor]
  const lit = hover ?? skill
  const hot = lit !== null && bullet.tags.includes(lit)
  const dim = skill !== null && !bullet.tags.includes(skill)
  return (
    <li
      id={anchor}
      className={[
        'group relative max-w-[72ch] scroll-mt-28 rounded-[10px] border-[1.5px] py-2.5 pl-[30px] pr-3 leading-relaxed transition-[background-color,opacity,border-color] duration-300',
        hot ? 'border-forest' : 'border-transparent',
        nums ? 'bg-marker' : hot ? 'bg-forest/[0.07]' : 'hover:bg-white',
        dim ? 'opacity-30' : '',
      ].join(' ')}
    >
      <span aria-hidden className={`absolute left-[13px] top-5 size-1.5 rounded-[1px] ${nums ? 'bg-coral' : 'bg-muted/60'}`} />
      {nums && (
        <span aria-hidden className="mr-1.5 font-mono text-[11px] font-medium text-coral-ink">
          [{nums.join(',')}]
        </span>
      )}
      <Emphasized text={bullet.text} />
      {nums && <span className="sr-only"> (cited in the latest answer)</span>}{' '}
      <button
        type="button"
        onClick={() => ask(questionAbout(bullet.text))}
        className="ml-1.5 rounded-md border border-rule bg-white px-2 py-0.5 align-[1px] text-[12.5px] font-medium text-forest opacity-0 transition-opacity hover:border-forest focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 pointer-fine:absolute pointer-fine:-top-3 pointer-fine:right-2.5 pointer-fine:z-[1] pointer-fine:m-0 pointer-fine:shadow-[0_2px_8px_rgb(0_0_0/0.08)] print:hidden"
      >
        Ask about this
      </button>
    </li>
  )
}

/** The lines of one role, build or community block, by the block's anchor. */
export function Lines({ group }: { group: string }) {
  return (
    <ul className="grid gap-0.5">
      {LINES.filter((l) => l.group === group).map((l) => (
        <Bullet key={l.anchor} anchor={l.anchor} bullet={l.bullet} />
      ))}
    </ul>
  )
}
