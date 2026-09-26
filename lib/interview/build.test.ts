import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '@/content/questions'
import { OUTPUT, buildInterviewHtml, compileCore } from '@/scripts/build-interview'
import { parseExport, parsePack } from '@/lib/interview'
import { NOW, SAMPLE_PACK, TODAY } from './test-fixtures'

const html = buildInterviewHtml()

describe('interview/raj-interview.html build', () => {
  it('contains every question id and the embedded Chicago font', () => {
    for (const q of QUESTIONS) expect(html, q.id).toContain(`"id":"${q.id}"`)
    expect(html).toMatch(/@font-face\s*{\s*font-family: 'Chicago';\s*src: url\(data:font\/woff;base64,[A-Za-z0-9+/=]{20000,}\)/)
    expect(html).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
  })

  it('loads nothing from the network', () => {
    // Question text may mention URLs; the markup, CSS and scripts may not.
    const data = html.match(/<script type="application\/json" id="stack-data">([\s\S]*?)<\/script>/)
    expect(data).not.toBeNull()
    const markup = html.replace(data![0], '')
    expect(markup).not.toMatch(/\b(?:src|href|action|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//i)
    expect(markup).not.toMatch(/url\(\s*["']?\s*(?:https?:)?\/\//i)
    expect(markup).not.toMatch(/@import/i)
    expect(markup).not.toMatch(/<link\b/i)
    expect(markup).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/)
  })

  it('never carries answers: the page holds the bank, and state lives in localStorage', () => {
    expect(html).not.toMatch(/"answers":\s*\{\s*"/)
    expect(html).toContain("var STORAGE_KEY = 'raj-clone-stack:v1'")
  })

  it('embeds the bank as JSON that cannot break out of its script tag', () => {
    const data = html.match(/<script type="application\/json" id="stack-data">([\s\S]*?)<\/script>/)![1]
    expect(data).not.toContain('<')
    const parsed = JSON.parse(data) as { questions: unknown[]; topicIds: string[]; types: string[] }
    expect(parsed.questions).toHaveLength(QUESTIONS.length)
    expect(parsed.topicIds).toContain('notes')
  })

  it('is committed up to date (run `bun scripts/build-interview.ts` after editing the bank)', () => {
    expect(readFileSync(OUTPUT, 'utf8') === html).toBe(true)
  })

  it("runs the compiled core the page ships, and the page's own export passes the zod schema", () => {
    type Core = typeof import('./core')
    const core = runInNewContext(`${compileCore()}; StackCore`, {}) as Core
    const data = JSON.parse(html.match(/<script type="application\/json" id="stack-data">([\s\S]*?)<\/script>/)![1]) as {
      questions: typeof QUESTIONS
      topicIds: string[]
      types: string[]
      bankVersion: string
    }
    const s = core.emptyState(NOW)
    // What the UI does: answer a few cards of different types, import a pack, add a custom card.
    const pick = (t: string): (typeof QUESTIONS)[number] => data.questions.find((q) => q.type === t)!
    const at = { answeredAt: NOW, updatedAt: NOW }
    s.answers[pick('open').id] = { text: 'Reliability first, because people act on the answers.', ...at }
    s.answers[pick('this-or-that').id] = { text: 'It compounds.', choice: pick('this-or-that').options![0], ...at }
    s.answers[pick('scale').id] = { text: '', value: 2, ...at }
    s.answers[pick('story').id] = { text: '', parts: { situation: 'Monday outages.', lesson: 'Alert earlier.' }, ...at }
    s.answers[pick('rapid').id] = { text: 'Postgres', ...at }
    const check = core.checkPack(JSON.parse(JSON.stringify(SAMPLE_PACK)), data.topicIds, data.types)
    expect(check.ok).toBe(true)
    s.packCards.push(...core.packToCards(check.pack!, new Set(data.questions.map((q) => q.id))).cards)
    s.answers['followup-20260925-01'] = { text: 'Faithfulness to the cited section.', ...at }
    s.custom.push({ id: 'custom-0b7c2f1a-1111-4222-8333-944455556666', topic: 'life', type: 'open', prompt: 'Why curly?', depth: 2, why: 'x', source: 'custom' })
    s.answers['custom-0b7c2f1a-1111-4222-8333-944455556666'] = { text: 'The hair.', ...at }
    const exported = core.buildExport(s, core.allCards(data.questions, s), { scope: 'all', now: NOW, bankVersion: data.bankVersion, today: TODAY })
    const r = parseExport(JSON.parse(JSON.stringify(exported)))
    expect(r.ok, r.ok ? '' : r.errors.join('\n')).toBe(true)
    if (r.ok) expect(r.data.answers).toHaveLength(7)
    expect(parsePack(JSON.parse(JSON.stringify(SAMPLE_PACK))).ok).toBe(true)
  })
})
