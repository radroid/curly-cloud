import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { Builds } from './builds'
import { Contact } from './closing'
import { Community } from './community'
import { Profile } from './profile'
import { SiteProvider } from './site-context'
import { SkillLens } from './skills'
import { Roles, Study } from './work'

// Citations scroll to resume anchors, so every public source needs exactly one element with its
// id in the server HTML, collapsed or not (REDESIGN-PLAN.md §6).
describe('resume anchors', () => {
  const sections = [Profile, SkillLens, Roles, Builds, Community, Study, Contact]
  const html = renderToStaticMarkup(createElement(SiteProvider, null, createElement(Fragment, null, ...sections.map((s) => createElement(s)))))
  const anchors = [...new Set(resumeSources().flatMap((s) => (s.visibility === 'public' && s.anchor ? [s.anchor] : [])))]

  it('covers the public sources', () => {
    expect(anchors.length).toBeGreaterThan(30)
  })

  it.each(anchors)('renders #%s once', (anchor) => {
    expect(html.split(`id="${anchor}"`).length - 1).toBe(1)
  })
})
