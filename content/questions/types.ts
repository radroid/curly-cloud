/**
 * Shapes for the interview question bank. The bank is public and committed; Raj's answers are not.
 * `lib/interview/schema.ts` mirrors these with zod for question packs and exports.
 */

export const QUESTION_TYPES = ['open', 'story', 'scenario', 'this-or-that', 'scale', 'rapid'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

/** Interview topics from content/topics.ts (origin: 'interview'), in stack order. */
export const INTERVIEW_TOPIC_IDS = [
  'origins',
  'principles',
  'decisions',
  'engineering',
  'ai',
  'leadership',
  'conflict',
  'failure',
  'work-style',
  'career',
  'stories',
  'life',
  'lightning',
  'notes',
] as const
export type InterviewTopicId = (typeof INTERVIEW_TOPIC_IDS)[number]

export interface ScaleSpec {
  min: number
  max: number
  minLabel: string
  maxLabel: string
}

export interface Question {
  /** `<topic>-<nnn>`, stable forever. Never renumber or reuse a retired id. */
  id: string
  topic: InterviewTopicId
  type: QuestionType
  prompt: string
  /** Shown under "dig deeper". For stories: situation / what you did / what happened / what you'd change. */
  hint?: string
  followUps?: string[]
  /** 1 = warm-up, 2 = considered, 3 = deep. */
  depth: 1 | 2 | 3
  /** What the clone learns from the answer. */
  why: string
  /** Exactly two, for `this-or-that`. */
  options?: [string, string]
  /** For `scale`. */
  scale?: ScaleSpec
}
