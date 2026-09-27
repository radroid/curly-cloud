import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RESUME, resumeAnchor } from '@/content/resume'
import { BUILD_FACTS, Builds, EVAL_POINTS, SEARCH_LANES } from './builds'
import { nLines } from './resume-helpers'
import { SiteProvider } from './site-context'

// Honesty rule (REDESIGN-PLAN.md §1): every number or label in a build's diagram or chips is stated
// in that build's text in content/resume.ts, so a resume edit can't leave a stale figure behind.

const WORDS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' }

/** Spelled-out small numbers also count as numerals: "three named vectors" backs a 3. */
const withNumerals = (s: string): string => s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (w) => `${w} ${WORDS[w.toLowerCase()]}`)

function buildText(id: string): string {
  const b = RESUME.builds.find((x) => x.id === id)
  if (!b) throw new Error(`no build ${id}`)
  return [b.title, b.period, ...b.stack, b.link?.label ?? '', ...b.bullets.map((x) => x.text)].join('\n')
}

const lineText = (id: string, line: string): string => RESUME.builds.find((b) => b.id === id)?.bullets.find((b) => b.id === line)?.text ?? ''

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** What a reader sees or hears in a card: its text and its aria-labels, minus derived line counts. */
function shown(card: string): string {
  const labels = [...card.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1])
  const text = card.replace(/<[^>]+>/g, ' ')
  return decode([text, ...labels].join('\n')).replace(/\b\d+ (?:lines?|cited|match)\b/g, '')
}

const html = renderToStaticMarkup(createElement(SiteProvider, null, createElement(Builds)))

function card(id: string): string {
  const m = html.match(new RegExp(`<article[^>]*id="${resumeAnchor('build', id)}"[\\s\\S]*?</article>`))
  if (!m) throw new Error(`no card for ${id}`)
  return m[0]
}

describe('build facts', () => {
  const facts = Object.entries(BUILD_FACTS).flatMap(([id, fs]) => fs.map((f) => [`${id}: ${f.value} ${f.label}`, id, f] as const))

  it.each(facts)('%s is stated in the build', (_, id, f) => {
    expect(buildText(id)).toContain(f.match)
    expect(withNumerals(f.match)).toContain(f.value)
  })

  it('shows shall and should apart only because the line says so', () => {
    const f = BUILD_FACTS.regdocs.find((x) => x.value === 'shall')
    expect(f?.match).toContain('should')
  })
})

describe('eval chart', () => {
  const evals = lineText('regdocs', 'evals')

  it('plots hit@8 in the order the line gives it', () => {
    const [a, b, c] = EVAL_POINTS.map((p) => `${p.value}%`)
    expect(evals).toContain(`embedding upgrade (hit@8 ${a} to ${b}`)
    expect(evals).toContain(`corpus grew (hit@8 ${b} to ${c}`)
  })

  it('labels the releases with what the line says happened', () => {
    expect(evals).toContain('embedding upgrade')
    expect(evals).toContain('corpus grew')
    expect(evals).toContain('held the production release')
    expect(EVAL_POINTS.filter((p) => p.held).map((p) => p.value)).toEqual([EVAL_POINTS[EVAL_POINTS.length - 1].value])
  })
})

describe('search pipeline', () => {
  const text = buildText('jobsearch')

  it('names the three vectors the line names', () => {
    expect(SEARCH_LANES).toHaveLength(3)
    expect(text).toContain(`three named embedding vectors per posting: ${SEARCH_LANES[0]}, ${SEARCH_LANES[1]} and ${SEARCH_LANES[2]}`)
  })

  it('follows the query pipeline line', () => {
    const line = lineText('jobsearch', 'pipeline')
    for (const step of ['structured intent', 'Reciprocal Rank Fusion', 'top 10']) expect(line).toContain(step)
  })
})

describe('build cards', () => {
  it.each(RESUME.builds.map((b) => [b.id]))('every number on the %s card is in its text', (id) => {
    const text = withNumerals(buildText(id))
    for (const [n] of shown(card(id)).matchAll(/\d+(?:[.,]\d+)*/g)) {
      expect(text, `"${n}" on the ${id} card`).toMatch(new RegExp(`(?<![\\d.,])${n.replace(/\./g, '\\.')}(?![\\d])`))
    }
  })

  it('draws the diagrams as labelled images', () => {
    expect(card('regdocs')).toMatch(/<svg[^>]*role="img"[^>]*aria-label="hit@8 went from 95\.7% to 96\.7%/)
    expect(card('jobsearch')).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Query pipeline:/)
  })

  it.each(RESUME.builds.map((b) => [b.id, b] as const))('%s links out, lists its stack and shows its lines', (_, b) => {
    const c = card(b.id)
    if (b.link) expect(c).toContain(`href="${b.link.href}" target="_blank" rel="noopener"`)
    expect(c.includes('aria-label="Stack"')).toBe(b.stack.length > 0)
    if (b.bullets.length > 1) {
      expect(c).toContain(`data-opens="lines-${b.id}"`)
      expect(c).toMatch(new RegExp(`<details[^>]*id="lines-${b.id}"`))
      expect(c).toContain(nLines(b.bullets.length))
    } else {
      expect(c).not.toContain('<details')
    }
  })
})
