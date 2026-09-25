import { describe, expect, it } from 'vitest'
import { QUESTIONS, QUESTION_TYPES } from '@/content/questions'
import {
  allCards,
  answersToSources,
  buildExport,
  checkBackup,
  buildBackup,
  checkPack,
  currentStreak,
  emptyState,
  fidelity,
  levelFor,
  newBadges,
  normalizeState,
  parseExport,
  parsePack,
  richness,
  unexportedIds,
  xpFor,
  type AnswersExport,
} from '@/lib/interview'
import { NOW, SAMPLE_PACK, TODAY, TOPIC_IDS, firstOfType, sampleExport, sampleState } from './test-fixtures'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

describe('raj-clone-answers export', () => {
  it('is built by the core and passes the zod schema, after a JSON round trip', () => {
    const exported = sampleExport()
    expect(exported.answers.length).toBe(8)
    const parsed = parseExport(clone(exported))
    expect(parsed.ok, parsed.ok ? '' : parsed.errors.join('\n')).toBe(true)
    const types = new Set(exported.answers.map((a) => a.type))
    for (const t of QUESTION_TYPES) expect(types.has(t), t).toBe(true)
    expect(exported.answers.find((a) => a.source === 'custom')?.qid).toMatch(/^custom-/)
    expect(exported.answers.find((a) => a.source === 'pack')?.packId).toBe('pack-2026-09-25')
    expect(exported.stats.streakDays).toBe(3)
  })

  it('exports only new or changed answers since the last export', () => {
    const s = sampleState()
    const cards = allCards(QUESTIONS, s)
    s.lastExportAt = '2026-09-25T12:00:00.000Z'
    expect(unexportedIds(s, cards)).toEqual([])
    const id = firstOfType('open').id
    s.answers[id] = { ...s.answers[id], text: 'Edited after the export.', updatedAt: '2026-09-25T13:00:00.000Z' }
    const out = buildExport(s, cards, { scope: 'since-last-export', now: NOW, bankVersion: 'b1', today: TODAY })
    expect(out.answers.map((a) => a.qid)).toEqual([id])
    expect(out.since).toBe('2026-09-25T12:00:00.000Z')
    expect(out.stats.answered).toBe(8)
    expect(parseExport(clone(out)).ok).toBe(true)
  })

  it('names the card and the problem when validation fails', () => {
    const bad = clone(sampleExport()) as unknown as { answers: Record<string, unknown>[] }
    const scaleIdx = bad.answers.findIndex((a) => a.type === 'scale')
    ;(bad.answers[scaleIdx].answer as { value: number }).value = 9
    const totIdx = bad.answers.findIndex((a) => a.type === 'this-or-that')
    ;(bad.answers[totIdx].answer as { choice: string }).choice = 'Neither'
    bad.answers[0].answeredAt = 'yesterday'
    const r = parseExport(bad)
    expect(r.ok).toBe(false)
    if (r.ok) return
    const text = r.errors.join('\n')
    expect(text).toContain(`Card ${scaleIdx + 1} (${bad.answers[scaleIdx].qid}`)
    expect(text).toMatch(/answer\.value must be between 1 and 5/)
    expect(text).toMatch(/"Neither" is not one of the options/)
    expect(text).toMatch(/Card 1 .*answeredAt must be an ISO date/)
  })

  it('explains a wrong file instead of dumping schema errors', () => {
    const r = parseExport(SAMPLE_PACK)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors[0]).toMatch(/question pack: import it into interview\/raj-interview\.html/)
    const junk = parseExport([1, 2, 3])
    expect(junk.ok).toBe(false)
  })
})

describe('answersToSources', () => {
  const sources = (): ReturnType<typeof answersToSources> => {
    const r = parseExport(clone(sampleExport()))
    if (!r.ok) throw new Error(r.errors.join('\n'))
    return answersToSources(r.data)
  }

  it('maps each answer to a private source with a stable id and metadata', () => {
    const out = sources()
    expect(out).toHaveLength(8)
    for (const s of out) {
      expect(s.visibility).toBe('private')
      expect(s.id).toMatch(/^interview:/)
      expect(s.meta).toMatchObject({ source: 'interview-stack' })
      expect(typeof s.meta?.wordCount).toBe('number')
      expect(s.body.trim()).not.toBe('')
    }
    const open = out.find((s) => s.id === `interview:${firstOfType('open').id}`)!
    expect(open).toMatchObject({ kind: 'interview', topic: firstOfType('open').topic, title: firstOfType('open').prompt })
    expect(open.meta).toMatchObject({ type: 'open', qid: firstOfType('open').id, depth: firstOfType('open').depth, starred: true })
  })

  it('keeps the meaning of each question type in the body', () => {
    const out = sources()
    const by = (id: string): string => out.find((s) => s.id === `interview:${id}`)!.body
    const tot = firstOfType('this-or-that')
    expect(by(tot.id)).toBe(`I'd pick ${tot.options![1]} over ${tot.options![0]}. Why: Because it compounds.`)
    const scale = firstOfType('scale')
    expect(by(scale.id)).toBe(
      `On a scale from ${scale.scale!.minLabel} (1) to ${scale.scale!.maxLabel} (5), I'm a 4/5. Why: I lean pragmatic but not reckless.`,
    )
    const story = by(firstOfType('story').id)
    expect(story).toContain('It was 2023 at ARO.')
    expect(story).toContain('Situation: Recurring queue failures every Monday.')
    expect(story).toContain('What I did: I added alerts and a runbook.')
    expect(story).toContain('What happened: Incidents fell by 20%.')
    expect(story).toContain("What I'd do differently: Alert earlier.")
    const scenario = by(firstOfType('scenario').id)
    expect(scenario).toMatch(/^Scenario: /)
    expect(scenario).toContain("What I'd do: First I would ask")
    expect(scenario.split('\n')[0]).not.toContain('?')
    expect(by(firstOfType('rapid').id)).toBe(`Quick answer to "${firstOfType('rapid').prompt}": Oat flat white`)
  })

  it('stores custom cards as notes and pack cards as interview answers', () => {
    const out = sources()
    const custom = out.find((s) => s.id.startsWith('interview:custom-'))!
    expect(custom).toMatchObject({ kind: 'note', topic: 'notes', title: 'The time I rebuilt my site as a 1984 Mac', visibility: 'private' })
    const pack = out.find((s) => s.id === 'interview:followup-20260925-01')!
    expect(pack).toMatchObject({ kind: 'interview', topic: 'ai' })
    expect(pack.meta).toMatchObject({ card: 'pack', packId: 'pack-2026-09-25' })
  })

  it('skips empty answers', () => {
    const exported = clone(sampleExport()) as AnswersExport
    exported.answers[0].answer = { text: '   ', choice: null, value: null, parts: { situation: '' } }
    const r = parseExport(exported)
    expect(r.ok).toBe(true)
    if (r.ok) expect(answersToSources(r.data)).toHaveLength(7)
  })
})

describe('question packs', () => {
  it('passes both the browser check and the zod schema', () => {
    expect(checkPack(SAMPLE_PACK, TOPIC_IDS, QUESTION_TYPES).ok).toBe(true)
    expect(parsePack(clone(SAMPLE_PACK)).ok).toBe(true)
  })

  it('is rejected by both for the same problems', () => {
    const bad = clone(SAMPLE_PACK) as unknown as { questions: Record<string, unknown>[] }
    bad.questions[1].options = ['Only one']
    bad.questions[0].topic = 'astrology'
    bad.questions.push({ ...bad.questions[0], topic: 'ai' })
    const browser = checkPack(bad, TOPIC_IDS, QUESTION_TYPES)
    const server = parsePack(bad)
    expect(browser.ok).toBe(false)
    expect(server.ok).toBe(false)
    expect(browser.errors.join('\n')).toMatch(/Question 2 \(followup-20260925-02\): this-or-that needs options/)
    expect(browser.errors.join('\n')).toMatch(/Question 1 .*topic must be one of/)
    expect(browser.errors.join('\n')).toMatch(/duplicate id/)
    if (!server.ok) expect(server.errors.join('\n')).toMatch(/Question 2 \(followup-20260925-02.*options/)
    // zod runs the pack-level duplicate check once the questions themselves are valid.
    const dup = clone(SAMPLE_PACK)
    dup.questions.push({ ...dup.questions[0] })
    const dupServer = parsePack(dup)
    expect(dupServer.ok).toBe(false)
    if (!dupServer.ok) expect(dupServer.errors.join('\n')).toMatch(/Question 3 \(followup-20260925-01.*duplicate id/)
    expect(checkPack(dup, TOPIC_IDS, QUESTION_TYPES).ok).toBe(false)
  })

  it('refuses an answers export with a helpful message', () => {
    const r = checkPack(sampleExport(), TOPIC_IDS, QUESTION_TYPES)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/answers export/)
  })
})

describe('scoring', () => {
  it('rewards specifics more than length', () => {
    const padded = 'I think it is really important to be good at the job and do things well. '.repeat(12)
    const specific =
      'At Pinhous in 2024 I cut deploys from 15 minutes to 2 with Docker, because rollbacks were manual. Looking back, I would add alerts first.'
    expect(richness(specific).score).toBeGreaterThan(richness(padded).score)
    expect(richness(specific).level).toBeGreaterThanOrEqual(3)
    expect(richness('').score).toBe(0)
  })

  it('scales XP by type, depth and substance', () => {
    const shallow = { type: 'open' as const, depth: 1 as const }
    const deep = { type: 'open' as const, depth: 3 as const }
    const a = { text: 'At ARO in 2023 I owned on-call because nobody else would, and I learned to write runbooks first.' }
    expect(xpFor(deep, a)).toBeGreaterThan(xpFor(shallow, a))
    expect(xpFor({ type: 'story', depth: 2 }, a)).toBeGreaterThan(xpFor({ type: 'rapid', depth: 2 }, a))
    expect(xpFor(shallow, { text: '' })).toBe(0)
    expect(xpFor({ type: 'this-or-that', depth: 1 }, { text: '', choice: 'A' })).toBeGreaterThan(0)
  })

  it('names levels and counts streaks across month ends', () => {
    expect(levelFor(0).name).toBe('Punch Card')
    expect(levelFor(99_999).name).toBe('Actual Raj')
    expect(levelFor(99_999).next).toBeNull()
    expect(currentStreak(['2026-08-30', '2026-08-31', '2026-09-01'], '2026-09-01')).toBe(3)
    expect(currentStreak(['2026-08-30', '2026-08-31'], '2026-09-01')).toBe(2)
    expect(currentStreak(['2026-08-30'], '2026-09-01')).toBe(0)
  })

  it('awards badges once, including time-of-day ones', () => {
    const s = sampleState()
    const cards = allCards(QUESTIONS, s)
    const earned = newBadges(s, cards, { today: TODAY, savedAtHour: 2 })
    expect(earned).toEqual(expect.arrayContaining(['first-card', 'night-owl', 'on-a-roll']))
    expect(earned).not.toContain('early-bird')
    for (const id of earned) s.badges[id] = NOW
    expect(newBadges(s, cards, { today: TODAY, savedAtHour: 2 })).toEqual([])
    expect(newBadges(s, cards, { today: TODAY, lightningRun: 10 })).toContain('lightning-rod')
    expect(fidelity(s, cards)).toBeGreaterThan(0)
    expect(fidelity(emptyState(NOW), cards)).toBe(0)
  })

  it('survives junk in storage and round-trips a backup', () => {
    expect(normalizeState('nope', NOW)).toEqual(emptyState(NOW))
    const weird = normalizeState({ answers: { x: 5, y: { text: 'hi', value: 'three' } }, activeDays: ['bad', '2026-09-01'] }, NOW)
    expect(Object.keys(weird.answers)).toEqual(['y'])
    expect(weird.answers.y.value).toBeUndefined()
    expect(weird.activeDays).toEqual(['2026-09-01'])
    const s = sampleState()
    const back = checkBackup(clone(buildBackup(s, NOW, 'b1')), NOW)
    expect(back.ok).toBe(true)
    if (back.ok) expect(back.state).toEqual(s)
    expect(checkBackup(sampleExport(), NOW).ok).toBe(false)
  })
})
