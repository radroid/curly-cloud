import { resumeSources } from '@/content/resume'
import { PERSONAL_DOTS, WORK_CARDS } from '@/content/star-cards'

/**
 * One bright point in the hero cloud (HERO-STARS-PLAN.md). Work dots are the public sources the clone
 * can cite and open their line on the page; personal dots are hover only, unless they have an `href`.
 */
export interface Star {
  kind: 'work' | 'personal'
  /** On the card: the company, project or section, or the personal item. */
  name: string
  /** Up to three words about the item. */
  words: readonly string[]
  /** Work dots: the resume line to open. */
  anchor?: string
  /** A page to open on click. */
  href?: string
}

/** Every public source with a place on the page, in knowledge-base order. */
export const STARS: Star[] = resumeSources().flatMap((s) => {
  if (s.visibility !== 'public' || !s.anchor) return []
  const card = WORK_CARDS[s.anchor]
  return [{ kind: 'work' as const, name: card?.name ?? s.title.replace(/^(Resume|Profile) · /, ''), words: card?.words ?? [], anchor: s.anchor }]
})

export const PERSONAL: Star[] = PERSONAL_DOTS.map((d) => ({ kind: 'personal', name: d.name, words: d.words ?? [], href: d.href }))

/** The order the renderer draws them in: work dots first, so their indices match `STARS`. */
export const ALL_STARS: Star[] = [...STARS, ...PERSONAL]
