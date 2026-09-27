import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESUME, resumeSources } from '@/content/resume'
import { CHART, countAt, Numbers, spokenValue, yearSegments } from './numbers'
import { SiteProvider } from './site-context'
import { formatStat, STATS, type Stat } from './stats'

const stat = (id: string): Stat => {
  const s = STATS.find((x) => x.id === id)
  if (!s) throw new Error(`no stat ${id}`)
  return s
}
const body = (s: Stat): string => resumeSources().find((x) => x.anchor === s.anchor)?.body ?? ''

// Every figure a chart draws or prints must be one its source line states (REDESIGN-PLAN.md §1).
describe('unit charts', () => {
  it('years: one segment per year, from the first role', () => {
    const first = RESUME.experience.reduce((a, b) => (b.start < a.start ? b : a))
    const years = yearSegments(stat('years').value)
    expect(years).toHaveLength(6)
    expect(years[0]).toBe(Number(first.start.slice(0, 4)))
    expect(years).toEqual([2020, 2021, 2022, 2023, 2024, 2025])
  })

  it('devices: each dot is 1,000 devices', () => {
    const s = stat('devices')
    expect(Number.isInteger(s.value / CHART.devicesPerDot)).toBe(true)
    expect(body(s)).toContain(`${formatStat(s.value)}+ LoRaWAN devices`)
  })

  it('processes: one tick per process and the manual-work bar', () => {
    const s = stat('processes')
    expect(body(s)).toContain(`${s.value}+ weekly processes`)
    expect(body(s)).toContain(`about ${CHART.manualWorkCut * 100}%`)
  })

  it('deploys: the bar and its labels are the two times in the line', () => {
    const s = stat('deploys')
    expect(body(s)).toContain(`from ${s.from} minutes to ${s.value}`)
  })

  it('postings: each mark is 1,000 postings with the three named vectors', () => {
    const s = stat('postings')
    expect(s.suffix).toBe('K')
    expect(body(s)).toContain(`~${s.value}K`)
    expect(body(s)).toContain('three named embedding vectors per posting: explicit, inferred and company')
    expect(CHART.vectors).toEqual(['explicit', 'inferred', 'company'])
  })

  it('docs: the priority and best-practice split behind 40+', () => {
    const s = stat('docs')
    expect(body(s)).toContain(`${CHART.priorityDocs} priority REGDOCs plus ${CHART.bestPracticeDocs} best-practice`)
    expect(CHART.priorityDocs + CHART.bestPracticeDocs).toBeGreaterThanOrEqual(s.value)
  })
})

describe('counter', () => {
  it('runs from the start value to the final one', () => {
    expect(countAt(stat('devices'), 0)).toBe(0)
    expect(countAt(stat('devices'), 1)).toBe(150_000)
    expect(countAt(stat('deploys'), 0)).toBe(15)
    expect(countAt(stat('deploys'), 0.5)).toBe(9)
    expect(countAt(stat('deploys'), 1)).toBe(2)
  })

  it('speaks the final value', () => {
    expect(spokenValue(stat('years'))).toBe('6')
    expect(spokenValue(stat('devices'))).toBe('150,000+')
    expect(spokenValue(stat('postings'))).toBe('100K')
    expect(spokenValue(stat('deploys'))).toBe('15 to 2 min')
  })
})

describe('Numbers', () => {
  const html = renderToStaticMarkup(createElement(SiteProvider, null, createElement(Numbers)))

  it('has a heading for screen readers', () => {
    expect(html).toMatch(/<section aria-labelledby="numbers-title"[^>]*><h2 id="numbers-title" class="sr-only">Numbers from the resume<\/h2>/)
  })

  it('puts the final values in the server HTML', () => {
    for (const s of STATS) {
      expect(html).toContain(`<span class="sr-only normal-case">${spokenValue(s)}</span>`)
      expect(html).toContain(`<span>${formatStat(s.value)}</span>`)
      expect(html).toContain(`source: ${s.source}</button>`)
    }
    // Full charts: no mark starts faint.
    expect(html).not.toContain('opacity-14')
  })
})
