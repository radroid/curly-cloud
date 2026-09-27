import { describe, expect, it } from 'vitest'
import { RESUME, resumeAnchor } from '@/content/resume'
import { fromIsoMonth, parseMonthPeriod, parseYearPeriod, timelineBars } from './timeline-data'

describe('period parsing', () => {
  it('parses build periods: one month or a month range', () => {
    expect(parseMonthPeriod('Jul 2026')).toEqual([2026 + 6 / 12, 2026 + 7 / 12])
    expect(parseMonthPeriod('Apr – Jul 2026')).toEqual([2026 + 3 / 12, 2026 + 7 / 12])
    expect(parseMonthPeriod('Feb 2026')).toEqual([2026 + 1 / 12, 2026 + 2 / 12])
  })

  it('rejects what it cannot place', () => {
    expect(parseMonthPeriod('2026')).toBeNull()
    expect(parseMonthPeriod('Summer 2026')).toBeNull()
    expect(parseMonthPeriod('Jul – Apr 2026')).toBeNull()
    expect(parseYearPeriod('Jul 2026')).toBeNull()
    expect(parseYearPeriod('2019 – 2016')).toBeNull()
  })

  it('parses year-only study periods, ending after the last year', () => {
    expect(parseYearPeriod('2016 – 2019')).toEqual([2016, 2020])
    expect(parseYearPeriod('2021 – 2022')).toEqual([2021, 2023])
    expect(parseYearPeriod('2024')).toEqual([2024, 2025])
  })

  it('parses every build and study period in the resume', () => {
    for (const b of RESUME.builds) expect(parseMonthPeriod(b.period), b.period).not.toBeNull()
    for (const e of RESUME.education) expect(parseYearPeriod(e.period), e.period).not.toBeNull()
  })

  it('reads ISO months as the start of the month', () => {
    expect(fromIsoMonth('2024-01')).toBe(2024)
    expect(fromIsoMonth('2024-07')).toBe(2024.5)
  })
})

describe('timelineBars', () => {
  const now = 2026 + 8.5 / 12
  const bars = timelineBars(now)

  it('has a bar for every role, build, community block and credential', () => {
    const anchors = bars.flatMap((b) => (b.anchor ? [b.anchor] : []))
    for (const r of RESUME.experience) expect(anchors).toContain(resumeAnchor('exp', r.id))
    for (const b of RESUME.builds) expect(anchors).toContain(resumeAnchor('build', b.id))
    for (const c of RESUME.community) expect(anchors).toContain(resumeAnchor('community', c.id))
    expect(bars.filter((b) => b.lane === 'study')).toHaveLength(RESUME.education.length)
  })

  it('never overlaps two roles on one work track', () => {
    const work = bars.filter((b) => b.lane === 'work')
    for (const a of work)
      for (const b of work) if (a !== b && a.track === b.track) expect(a.end <= b.start || b.end <= a.start, `${a.label} / ${b.label}`).toBe(true)
  })

  it('runs ongoing roles and community to now', () => {
    for (const b of bars.filter((x) => x.ongoing)) expect(b.end).toBe(now)
    expect(bars.find((b) => b.anchor === resumeAnchor('exp', 'eddy'))?.ongoing).toBe(true)
  })

  it('draws year-only study with soft ends', () => {
    for (const b of bars) expect(b.soft).toBe(b.lane === 'study')
  })
})
