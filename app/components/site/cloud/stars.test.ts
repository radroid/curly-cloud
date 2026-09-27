import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { STARS } from './stars'

describe('hero stars', () => {
  const sources = resumeSources().filter((s) => s.visibility === 'public' && s.anchor)

  it('has one star per public source with a place on the page', () => {
    expect(STARS).toHaveLength(sources.length)
    expect(STARS.map((s) => s.anchor)).toEqual(sources.map((s) => s.anchor))
    expect(new Set(STARS.map((s) => s.anchor)).size).toBe(STARS.length)
  })

  it('labels each star without the "Resume · " prefix', () => {
    for (const s of STARS) expect(s.title).not.toMatch(/^Resume · /)
    expect(STARS.find((s) => s.anchor === 'r-exp-eddy-mcp')?.title).toBe('Eddy Solutions')
  })

  it('shows the line itself, cut at a word to about 110 characters', () => {
    for (const s of STARS) {
      expect(s.snippet.length).toBeGreaterThan(0)
      expect(s.snippet.length).toBeLessThanOrEqual(108)
      if (s.snippet.endsWith('…')) expect(s.snippet).not.toMatch(/\s…$/)
    }
    const line = sources.find((s) => s.anchor === 'r-exp-eddy-mcp')
    expect(line?.body).toContain(STARS.find((s) => s.anchor === 'r-exp-eddy-mcp')?.snippet.replace(/…$/, ''))
  })
})
