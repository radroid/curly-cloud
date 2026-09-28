import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { PERSONAL_DOTS, WORK_CARDS } from '@/content/star-cards'
import { ALL_STARS, PERSONAL, STARS } from './stars'

describe('hero stars', () => {
  const sources = resumeSources().filter((s) => s.visibility === 'public' && s.anchor)

  it('has one work star per public source with a place on the page', () => {
    expect(STARS).toHaveLength(sources.length)
    expect(STARS.map((s) => s.anchor)).toEqual(sources.map((s) => s.anchor))
    expect(new Set(STARS.map((s) => s.anchor)).size).toBe(STARS.length)
  })

  it('names each work star without the source prefix, or by its short name', () => {
    for (const s of STARS) expect(s.name).not.toMatch(/^(Resume|Profile) · /)
    expect(STARS.find((s) => s.anchor === 'r-exp-eddy-mcp')?.name).toBe('Eddy Solutions')
    expect(STARS.find((s) => s.anchor === 'r-contact')?.name).toBe('Contact')
    expect(STARS.find((s) => s.anchor === 'r-build-earned-coach')?.name).toBe('Earned')
  })

  it('gives every work star three words, and has no cards for lines that are not stars', () => {
    for (const s of STARS) {
      expect(s.words, s.anchor).toHaveLength(3)
      for (const w of s.words) expect(w.trim(), s.anchor).not.toBe('')
    }
    const anchors = new Set(STARS.map((s) => s.anchor))
    for (const a of Object.keys(WORK_CARDS)) expect(anchors.has(a), a).toBe(true)
  })

  it('draws the personal dots after the work stars, hover only except Music', () => {
    expect(ALL_STARS).toEqual([...STARS, ...PERSONAL])
    expect(PERSONAL).toHaveLength(PERSONAL_DOTS.length)
    expect(new Set(PERSONAL_DOTS.map((d) => d.id)).size).toBe(PERSONAL_DOTS.length)
    for (const s of PERSONAL) {
      expect(s.kind).toBe('personal')
      expect(s.anchor).toBeUndefined()
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
