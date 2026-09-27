import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESUME, resumeAnchor } from '@/content/resume'
import { Community, TICKETS } from './community'
import { nLines } from './resume-helpers'
import { SiteProvider } from './site-context'

// Honesty rule (REDESIGN-PLAN.md §1): what a ticket names comes from its block in content/resume.ts.
describe('community tickets', () => {
  const html = renderToStaticMarkup(createElement(SiteProvider, null, createElement(Community)))
  const ticketed = RESUME.community.filter((c) => TICKETS[c.id])

  it('has a ticket for Open Invite', () => {
    expect(ticketed.map((c) => c.id)).toContain('open-invite')
  })

  it.each(ticketed.map((c) => [c.id, c] as const))('%s names only what its block says', (_, c) => {
    const t = TICKETS[c.id]
    const lines = c.bullets.map((b) => b.text).join('\n')
    for (const e of t.events) expect(lines).toContain(e)
    for (const p of t.platform) expect(lines).toContain(p)
    // "Open to everyone" is the blurb's "open-to-everyone".
    expect(c.blurb?.toLowerCase().replace(/-/g, ' ')).toContain(t.stub.toLowerCase())
  })

  it.each(RESUME.community.map((c) => [c.id, c] as const))('%s keeps its anchor and opens its lines from it', (_, c) => {
    const anchor = resumeAnchor('community', c.id)
    expect(html).toMatch(new RegExp(`<article[^>]*id="${anchor}"[^>]*data-opens="lines-${c.id}"`))
    expect(html).toMatch(new RegExp(`<details[^>]*id="lines-${c.id}"`))
    expect(html).toContain(nLines(c.bullets.length))
    if (c.url) expect(html).toContain(`href="${c.url}" target="_blank" rel="noopener"`)
    if (c.blurb) expect(html).toContain(c.blurb)
  })
})
