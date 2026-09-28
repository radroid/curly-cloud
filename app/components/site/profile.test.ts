import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESUME } from '@/content/resume'
import { PATH, pickQuotes, Profile, QUOTE_PATTERNS, QUOTES } from './profile'

describe('profile quotes', () => {
  it('finds all three sentences in the summary today', () => {
    expect(QUOTES).toHaveLength(QUOTE_PATTERNS.length)
    const summary = RESUME.summary.join(' ')
    for (const q of QUOTES) {
      expect(summary).toContain(q)
      expect(q).toMatch(/^I .+\.$/)
    }
  })

  it('drops a quote whose pattern stops matching instead of rendering it empty', () => {
    expect(pickQuotes('One. Two.', [/One\./, /Three\./, /Two\./])).toEqual(['One.', 'Two.'])
  })
})

describe('profile path', () => {
  it('reads each step from the resume', () => {
    const beng = RESUME.education.find((e) => e.id === 'beng')
    expect(PATH.map((n) => n.what)).toEqual(['Nuclear engineering', 'Software', 'GenAI infrastructure'])
    expect(PATH[0]).toMatchObject({ year: beng?.period.slice(0, 4), where: 'BEng, University of Manchester' })
    expect(PATH[1]).toMatchObject({ year: '2020', where: 'Duit.io, then full-stack roles' })
    expect(PATH[2]).toMatchObject({ year: '2024', where: `Create Club, now ${RESUME.experience[0].company}` })
  })

  it('runs forward in time', () => {
    const years = PATH.map((n) => Number(n.year))
    for (const y of years) expect(y).toBeGreaterThan(2000)
    expect([...years].sort()).toEqual(years)
  })
})

describe('Profile', () => {
  const html = renderToStaticMarkup(createElement(Profile))

  it('keeps the summary citable inside a disclosure', () => {
    expect(html.split('id="r-summary"')).toHaveLength(2)
    expect(html).toMatch(/<details id="r-summary" class="disclose[^"]*"><summary[^>]*>.*Read the full summary<\/summary>/)
    for (const p of [RESUME.pitch, ...RESUME.summary]) expect(html).toContain(`<p>${p}</p>`)
  })

  it('renders every path step and quote with text', () => {
    expect(html).not.toMatch(/<li[^>]*><\/li>/)
    for (const n of PATH) expect(html).toContain(n.where)
    for (const q of QUOTES) expect(html).toContain(q)
  })
})
