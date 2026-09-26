/**
 * The interview question bank: the questions Raj answers in interview/raj-interview.html.
 * Public and committed. Answers are private and never live in this repo.
 *
 * Ids are stable forever (`<topic>-<nnn>`). To retire a question, delete it and never reuse its id;
 * to reword one, keep the id only if the meaning is unchanged. Rebuild the HTML afterwards:
 * `bun scripts/build-interview.ts`.
 */
import { TOPICS, type TopicDef } from '@/content/topics'
import { AI } from './ai'
import { CAREER } from './career'
import { CONFLICT } from './conflict'
import { DECISIONS } from './decisions'
import { ENGINEERING } from './engineering'
import { FAILURE } from './failure'
import { LEADERSHIP } from './leadership'
import { LIFE } from './life'
import { LIGHTNING } from './lightning'
import { ORIGINS } from './origins'
import { PRINCIPLES } from './principles'
import { STORIES } from './stories'
import { INTERVIEW_TOPIC_IDS, type InterviewTopicId, type Question, type QuestionType } from './types'
import { WORK_STYLE } from './work-style'

export * from './types'

export const QUESTIONS: Question[] = [
  ...ORIGINS,
  ...PRINCIPLES,
  ...DECISIONS,
  ...ENGINEERING,
  ...AI,
  ...LEADERSHIP,
  ...CONFLICT,
  ...FAILURE,
  ...WORK_STYLE,
  ...CAREER,
  ...STORIES,
  ...LIFE,
  ...LIGHTNING,
]

/** Interview topics in stack order, with labels and blurbs from content/topics.ts. */
export const INTERVIEW_TOPICS: TopicDef[] = INTERVIEW_TOPIC_IDS.map((id) => {
  const def = TOPICS.find((t) => t.id === id)
  if (!def) throw new Error(`content/topics.ts is missing interview topic "${id}"`)
  return def
})

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))

export function getQuestion(id: string): Question | null {
  return BY_ID.get(id) ?? null
}

export function questionsByTopic(topic: InterviewTopicId): Question[] {
  return QUESTIONS.filter((q) => q.topic === topic)
}

export function questionsByType(type: QuestionType): Question[] {
  return QUESTIONS.filter((q) => q.type === type)
}

export function isInterviewTopic(id: string): id is InterviewTopicId {
  return (INTERVIEW_TOPIC_IDS as readonly string[]).includes(id)
}

/** Count per topic, for the README and the studio coverage view. */
export function questionCounts(questions: Question[] = QUESTIONS): Record<InterviewTopicId, number> {
  const out = Object.fromEntries(INTERVIEW_TOPIC_IDS.map((t) => [t, 0])) as Record<InterviewTopicId, number>
  for (const q of questions) out[q.topic] += 1
  return out
}
