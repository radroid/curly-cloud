import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESUME, resumeAnchor } from '@/content/resume'
import { SiteProvider } from './site-context'
import { SkillLens } from './skills'
import { HEADLINE, Roles, Study, topTags } from './work'

const render = (c: () => React.ReactNode): string => renderToStaticMarkup(createElement(SiteProvider, null, createElement(c)))

/** The numbers in a string, as written: "150,000+ devices" → ["150,000"]. */
const numbers = (s: string): string[] => s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []

describe('role headlines', () => {
  it.each(RESUME.experience.map((r) => [r.id, r] as const))('%s quotes a number from its own lines', (_, r) => {
    const headline = HEADLINE[r.id]
    expect(headline).toBeTruthy()
    expect(numbers(headline).length).toBeGreaterThan(0)
    const inLines = new Set(r.bullets.flatMap((b) => numbers(b.text)))
    for (const n of numbers(headline)) expect([...inLines], `${n} (${headline})`).toContain(n)
  })

  it('has no headline for a role that is gone', () => {
    const ids = new Set(RESUME.experience.map((r) => r.id))
    for (const id of Object.keys(HEADLINE)) expect(ids).toContain(id)
  })
})

describe('topTags', () => {
  it('ranks by lines, ties in line order, with filter labels', () => {
    const eddy = RESUME.experience.find((r) => r.id === 'eddy')!
    expect(topTags(eddy)).toEqual(['Next.js', 'RAG', 'Evals'])
  })
})

describe('role rows', () => {
  const html = render(Roles)

  it('puts each role anchor on a closed <details>', () => {
    for (const r of RESUME.experience) expect(html).toContain(`<details id="${resumeAnchor('exp', r.id)}" class="disclose`)
    expect(html).not.toMatch(/<details[^>]* open/)
  })

  it('counts roles and lines from the resume', () => {
    const lines = RESUME.experience.reduce((n, r) => n + r.bullets.length, 0)
    expect(html).toContain(`>${RESUME.experience.length} roles, ${lines} lines<`)
  })

  it('marks only the current role as now', () => {
    expect(html.match(/>now</g)).toHaveLength(RESUME.experience.filter((r) => r.end === null).length)
  })
})

describe('skill lens', () => {
  const html = render(SkillLens)

  it('opens the full skill list from the r-skills anchor', () => {
    expect(html).toContain('id="r-skills" data-opens="skills-full"')
    expect(html).toContain('<details id="skills-full"')
    for (const g of RESUME.skills) expect(html).toContain(`>${g.label}</dt>`)
  })

  it('starts unfiltered, with no pill', () => {
    expect(html).not.toContain('aria-pressed="true"')
    expect(html).not.toContain('Showing')
  })
})

describe('study strip', () => {
  it('keeps the full credential and school text', () => {
    const html = render(Study)
    expect(html).toContain('id="r-education"')
    for (const e of RESUME.education) {
      expect(html).toContain(e.credential.replace(/&/g, '&amp;'))
      expect(html).toContain(e.school)
    }
  })
})
