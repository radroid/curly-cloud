/**
 * Test fixtures: a stack state with one answer of every question type, a custom card and a pack
 * card, built through the same core functions the HTML uses. Contains no real answers.
 */
import { QUESTIONS, QUESTION_TYPES, type Question, type QuestionType } from '@/content/questions'
import { allCards, buildExport, checkPack, emptyState, packToCards, type AnswerRecord, type QuestionPack, type StackState } from './core'

export const NOW = '2026-09-25T18:30:00.000Z'
export const TODAY = '2026-09-25'
export const TOPIC_IDS = [...new Set(QUESTIONS.map((q) => q.topic)), 'notes']

export function firstOfType(type: QuestionType): Question {
  const q = QUESTIONS.find((x) => x.type === type)
  if (!q) throw new Error(`no ${type} question in the bank`)
  return q
}

export const SAMPLE_PACK: QuestionPack = {
  format: 'raj-clone-question-pack',
  version: 1,
  packId: 'pack-2026-09-25',
  title: 'Follow-ups from round 1',
  createdAt: NOW,
  note: 'You mentioned holding the regdocs release. A few follow-ups.',
  questions: [
    {
      id: 'followup-20260925-01',
      topic: 'ai',
      type: 'open',
      depth: 3,
      prompt: 'You said a generation eval was the missing piece. What would it have measured?',
      why: 'How he defines "good enough" for generation, beyond retrieval.',
      basedOn: ['stories-016'],
    },
    {
      id: 'followup-20260925-02',
      topic: 'work-style',
      type: 'this-or-that',
      depth: 1,
      prompt: 'Whiteboard or doc when you plan a deep dive?',
      options: ['Whiteboard', 'Doc'],
      why: 'How he externalises thinking.',
    },
  ],
}

function answer(text: string, extra: Partial<AnswerRecord> = {}): AnswerRecord {
  return { text, answeredAt: '2026-09-24T09:00:00.000Z', updatedAt: '2026-09-25T10:00:00.000Z', ...extra }
}

/** One non-empty answer for every question type, plus a custom story card and a pack card. */
export function sampleState(): StackState {
  const s = emptyState(NOW)
  const tot = firstOfType('this-or-that')
  const scale = firstOfType('scale')
  s.answers[firstOfType('open').id] = answer('I keep coming back to reliability because at Eddy the field team acts on what the app says.')
  s.answers[firstOfType('scenario').id] = answer('First I would ask for the three riskiest cases and build a 20-question eval before Friday.')
  s.answers[firstOfType('story').id] = answer('It was 2023 at ARO.', {
    parts: { situation: 'Recurring queue failures every Monday.', action: 'I added alerts and a runbook.', result: 'Incidents fell by 20%.', lesson: 'Alert earlier.' },
  })
  s.answers[tot.id] = answer('Because it compounds.', { choice: tot.options![1] })
  s.answers[scale.id] = answer('I lean pragmatic but not reckless.', { value: 4 })
  s.answers[firstOfType('rapid').id] = answer('Oat flat white')
  s.flags[firstOfType('open').id] = { starred: true }
  s.custom.push({
    id: 'custom-3f2b8c1e-8d4a-4b7e-9c1a-2e5f6a7b8c9d',
    topic: 'notes',
    type: 'story',
    prompt: 'The time I rebuilt my site as a 1984 Mac',
    depth: 2,
    why: 'Something Raj chose to add in his own words.',
    source: 'custom',
    createdAt: NOW,
  })
  s.answers['custom-3f2b8c1e-8d4a-4b7e-9c1a-2e5f6a7b8c9d'] = answer('I wanted the site to feel like a place, not a page.')
  const check = checkPack(SAMPLE_PACK, TOPIC_IDS, QUESTION_TYPES)
  if (!check.pack) throw new Error(check.errors.join('\n'))
  const { cards } = packToCards(check.pack, new Set(QUESTIONS.map((q) => q.id)))
  s.packCards.push(...cards)
  s.answers['followup-20260925-01'] = answer('Faithfulness against the cited section, and whether it separated shall from should.')
  s.activeDays = ['2026-09-23', '2026-09-24', '2026-09-25']
  return s
}

export function sampleExport(): ReturnType<typeof buildExport> {
  const s = sampleState()
  return buildExport(s, allCards(QUESTIONS, s), { scope: 'all', now: NOW, bankVersion: 'btest', today: TODAY })
}
