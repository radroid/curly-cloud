import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { formatStat, STATS } from './stats'

// Every number on the page must come from a resume line (REDESIGN-PLAN.md §1, honesty rule).
describe('STATS', () => {
  const sources = resumeSources()

  it.each(STATS.map((s) => [s.id, s] as const))('%s is backed by a public resume line', (_, stat) => {
    const src = sources.find((s) => s.anchor === stat.anchor)
    expect(src, `no source with anchor ${stat.anchor}`).toBeDefined()
    expect(src?.visibility).toBe('public')
    for (const m of stat.match) expect(src?.body).toContain(m)
    // The number shown is one the source line states.
    const quoted = stat.match.join(' ')
    expect(quoted).toContain(formatStat(stat.value))
    if (stat.from !== undefined) expect(quoted).toContain(formatStat(stat.from))
  })

  it('has unique ids', () => {
    expect(new Set(STATS.map((s) => s.id)).size).toBe(STATS.length)
  })

  it('formats thousands', () => {
    expect(formatStat(150_000)).toBe('150,000')
    expect(formatStat(6)).toBe('6')
  })
})
