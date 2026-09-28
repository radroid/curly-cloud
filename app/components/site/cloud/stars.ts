import { resumeAnchor, resumeSources } from '@/content/resume'
import { PERSONAL_DOTS, WORK_CARDS } from '@/content/star-cards'

/**
 * One bright point in the hero cloud (HERO-STARS-PLAN.md). Work dots are the companies, builds and
 * community work the clone can cite, plus Education, and open their block on the page; personal dots
 * are hover only, unless they have an `href`.
 */
export interface Star {
  kind: 'work' | 'personal'
  /** On the card: the company, project or section, or the personal item. */
  name: string
  /** Up to three words about the item. */
  words: readonly string[]
  /** Work dots: the role, build, community entry or section to open. */
  anchor?: string
  /** Work dots: the anchor of every public source in the block, for citations. Empty for personal dots. */
  sources: readonly string[]
  /** A page to open on click. */
  href?: string
}

/** Every public source with a place on the page, in knowledge-base order. */
const SOURCES = resumeSources().flatMap((s) => (s.visibility === 'public' && s.anchor ? [{ id: s.id, title: s.title, anchor: s.anchor }] : []))

/** How many public sources the clone can cite (the status card's corpus), not how many dots. */
export const SOURCE_COUNT = SOURCES.length

/** The block a source belongs to: its role, build or community entry, or Education. Null for summary, skills and contact. */
function groupOf(sourceId: string): string | null {
  const [, section, entry] = sourceId.split(':')
  if (section === 'exp' || section === 'build' || section === 'community') return resumeAnchor(section, entry)
  return sourceId === 'resume:education' ? resumeAnchor('education') : null
}

function workStars(): Star[] {
  const groups = new Map<string, { title: string; sources: string[] }>()
  for (const s of SOURCES) {
    const anchor = groupOf(s.id)
    if (!anchor) continue
    const g = groups.get(anchor) ?? { title: s.title, sources: [] }
    g.sources.push(s.anchor)
    groups.set(anchor, g)
  }
  return [...groups].map(([anchor, g]): Star => {
    const card = WORK_CARDS[anchor]
    return { kind: 'work', name: card?.name ?? g.title.replace(/^Resume · /, ''), words: card?.words ?? [], anchor, sources: g.sources }
  })
}

/** One work dot per block, ordered by the block's first source in knowledge-base order. */
export const STARS: Star[] = workStars()

export const PERSONAL: Star[] = PERSONAL_DOTS.map((d) => ({ kind: 'personal', name: d.name, words: d.words ?? [], sources: [], href: d.href }))

/** The order the renderer draws them in: work dots first, so their indices match `STARS`. */
export const ALL_STARS: Star[] = [...STARS, ...PERSONAL]

/** The citation numbers on any of a dot's sources, sorted, without repeats. `cited` maps a source anchor to its numbers. */
export function starCitations(star: Star, cited: Record<string, number[]>): number[] {
  return [...new Set(star.sources.flatMap((a) => cited[a] ?? []))].sort((a, b) => a - b)
}
