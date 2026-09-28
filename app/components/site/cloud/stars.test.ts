import { describe, expect, it } from 'vitest'
import { RESUME, resumeAnchor, resumeSources, type ResumeRole } from '@/content/resume'
import { PERSONAL_DOTS, WORK_CARDS } from '@/content/star-cards'
import { ALL_STARS, PERSONAL, SOURCE_COUNT, STARS, starCitations } from './stars'

/** A role or community entry's anchor, and the anchors of its lines (the blurb shares the entry's anchor). */
function entry(section: string, r: ResumeRole): { anchor: string; sources: string[] } {
  const anchor = resumeAnchor(section, r.id)
  return { anchor, sources: [...(r.blurb ? [anchor] : []), ...r.bullets.map((b) => resumeAnchor(section, r.id, b.id))] }
}

describe('hero stars', () => {
  const sources = resumeSources().flatMap((s) => (s.visibility === 'public' && s.anchor ? [s.anchor] : []))
  const blocks = [
    ...RESUME.experience.map((r) => entry('exp', r)),
    ...RESUME.builds.map((b) => ({ anchor: resumeAnchor('build', b.id), sources: b.bullets.map((x) => resumeAnchor('build', b.id, x.id)) })),
    ...RESUME.community.map((c) => entry('community', c)),
    { anchor: resumeAnchor('education'), sources: [resumeAnchor('education')] },
  ]

  it('has one work star per role, build and community entry, plus Education', () => {
    expect(STARS).toHaveLength(RESUME.experience.length + RESUME.builds.length + RESUME.community.length + 1)
    expect(STARS).toHaveLength(11)
    for (const s of STARS) expect(s.kind).toBe('work')
    expect(STARS.map((s) => s.anchor)).toEqual(blocks.map((b) => b.anchor))
  })

  it('opens the whole block, and cites every line in it', () => {
    expect(STARS.map((s) => ({ anchor: s.anchor, sources: s.sources }))).toEqual(blocks)
  })

  it('puts every public source under exactly one star, except summary, skills and contact', () => {
    const grouped = STARS.flatMap((s) => s.sources)
    expect(new Set(grouped).size).toBe(grouped.length)
    const rest = sources.filter((a) => !grouped.includes(a))
    expect(rest).toEqual(['r-summary', 'r-skills', 'r-contact'])
    expect(grouped).toHaveLength(sources.length - 3)
  })

  it('counts the public sources, not the stars', () => {
    expect(SOURCE_COUNT).toBe(sources.length)
    expect(SOURCE_COUNT).toBeGreaterThan(STARS.length)
  })

  it('names each work star from the resume, or by its short name', () => {
    const name = (anchor: string): string | undefined => STARS.find((s) => s.anchor === anchor)?.name
    for (const r of RESUME.experience) expect(name(resumeAnchor('exp', r.id))).toBe(r.company)
    for (const c of RESUME.community) expect(name(resumeAnchor('community', c.id))).toBe(c.company)
    expect(name('r-education')).toBe('Education')
    expect(name('r-build-regdocs')).toBe('Nuclear RegDocs assistant')
    expect(name('r-build-earned')).toBe('Earned')
    for (const s of STARS) expect(s.name).not.toMatch(/^Resume · /)
  })

  it('gives every work star three words, and has no cards for blocks that are not stars', () => {
    for (const s of STARS) {
      expect(s.words, s.anchor).toHaveLength(3)
      for (const w of s.words) expect(w.trim(), s.anchor).not.toBe('')
    }
    const anchors = new Set(STARS.map((s) => s.anchor))
    for (const a of Object.keys(WORK_CARDS)) expect(anchors.has(a), a).toBe(true)
  })

  it('lists the citations on any line of a block, sorted, without repeats', () => {
    const [eddy] = STARS
    expect(eddy.anchor).toBe('r-exp-eddy')
    expect(starCitations(eddy, {})).toEqual([])
    expect(starCitations(eddy, { 'r-exp-eddy-mcp': [4, 1], 'r-exp-eddy': [2], 'r-exp-eddy-rag': [1], 'r-skills': [3] })).toEqual([1, 2, 4])
    expect(starCitations(PERSONAL[0], { 'r-exp-eddy': [1] })).toEqual([])
  })

  it('draws the personal dots after the work stars, hover only except Music', () => {
    expect(ALL_STARS).toEqual([...STARS, ...PERSONAL])
    expect(PERSONAL).toHaveLength(PERSONAL_DOTS.length)
    expect(new Set(PERSONAL_DOTS.map((d) => d.id)).size).toBe(PERSONAL_DOTS.length)
    for (const s of PERSONAL) {
      expect(s.kind).toBe('personal')
      expect(s.anchor).toBeUndefined()
      expect(s.sources).toEqual([])
    }
    expect(PERSONAL.filter((s) => s.href).map((s) => s.name)).toEqual(['Music'])
    expect(PERSONAL.find((s) => s.name === 'Music')?.href).toBe('/mac?open=music')
  })

  it('gives words only to Habits, Second chances, Health, Outdoors and Music', () => {
    const worded = PERSONAL.filter((s) => s.words.length).map((s) => s.name)
    expect(worded.sort()).toEqual(['Habits', 'Health', 'Music', 'Outdoors', 'Second chances'])
    for (const s of PERSONAL) if (s.words.length) expect(s.words).toHaveLength(3)
  })
})
