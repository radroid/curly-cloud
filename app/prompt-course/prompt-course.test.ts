import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PROMPT_COURSE, PROMPT_COURSE_FILE } from '@/content/prompt-course'
import { PromptCopyProvider } from './prompt-copy'
import { PromptWindow } from './prompt-window'

describe('/prompt-course', () => {
  it('asks for nothing to fill in, because the page says to paste it as is', () => {
    expect(PROMPT_COURSE).not.toMatch(/\[[^\]]+\]/)
  })

  it('has the agent state what it assumed about the visitor', () => {
    expect(PROMPT_COURSE).toContain('What I assumed about you')
  })

  const html = renderToStaticMarkup(
    createElement(PromptCopyProvider, { text: PROMPT_COURSE, children: createElement(PromptWindow, { text: PROMPT_COURSE, file: PROMPT_COURSE_FILE }) }),
  )

  it('renders every line of the prompt once, in order', () => {
    const lines = PROMPT_COURSE.split('\n')
    expect(html.split('class="min-w-0"').length - 1).toBe(lines.length)
    let at = 0
    for (const line of lines.filter(Boolean)) {
      const escaped = line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
      const next = html.indexOf(escaped, at)
      expect(next, line).toBeGreaterThan(-1)
      at = next
    }
  })

  it('offers the copy key in the window', () => {
    expect(html).toContain('aria-keyshortcuts="C"')
  })
})
