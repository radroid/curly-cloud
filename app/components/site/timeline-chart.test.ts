import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESUME } from '@/content/resume'
import { SiteProvider } from './site-context'
import { Timeline, timelineAxis } from './timeline'
import { timelineBars } from './timeline-data'

const render = (): string => renderToStaticMarkup(createElement(SiteProvider, null, createElement(Timeline)))

describe('timeline chart', () => {
  afterEach(() => vi.useRealTimers())

  it('renders the same HTML whatever the server clock says', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'))
    const a = render()
    vi.setSystemTime(new Date('2027-03-15T12:00:00Z'))
    expect(render()).toBe(a)
  })

  it('is a labelled group of buttons, one per role and build', () => {
    const html = render()
    expect(html).not.toContain('role="img"')
    expect(html).toMatch(/<svg[^>]* role="group" aria-label="[^"]+"/)
    expect(html.match(/role="button"/g)).toHaveLength(RESUME.experience.length + RESUME.builds.length)
    for (const r of RESUME.experience) expect(html).toContain(`aria-label="Open ${r.role}, ${r.company}`.replace(/&/g, '&amp;'))
  })

  it('labels the builds lane with a derived count and titles each bar', () => {
    const html = render()
    expect(html).toContain(`>${RESUME.builds.length} builds<`)
    expect(html.match(/<title>/g)).toHaveLength(RESUME.builds.length)
  })

  it('compresses the years before the first role', () => {
    const now = 2026 + 8.5 / 12
    const { x, years, brk } = timelineAxis(timelineBars(now), now)
    expect(brk).toBe(Math.min(...RESUME.experience.map((r) => Number(r.start.slice(0, 4)))))
    for (let i = 1; i < years.length; i++) expect(x(years[i])).toBeGreaterThan(x(years[i - 1]))
    const before = (x(brk) - x(years[0])) / (brk - years[0])
    const after = x(brk + 1) - x(brk)
    expect(before).toBeLessThan(after)
    expect(x(now)).toBeLessThan(1000)
  })
})
