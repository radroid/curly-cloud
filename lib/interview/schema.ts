/**
 * zod schemas for the two files that cross the boundary between Raj's browser and the repo:
 *   - `raj-clone-answers` v1: exported by interview/raj-interview.html, imported by /api/admin/import.
 *   - `raj-clone-question-pack` v1: written by the ingest-answers skill, imported by the HTML.
 * The TypeScript shapes live in ./core (which the HTML runs); the type checks at the bottom keep
 * the two in lockstep.
 */
import { z } from 'zod'
import { INTERVIEW_TOPIC_IDS, QUESTION_TYPES } from '@/content/questions/types'
import {
  ANSWERS_FORMAT,
  ID_PATTERN,
  MAX_ANSWER_CHARS,
  MAX_PROMPT_CHARS,
  PACK_FORMAT,
  type AnswersExport,
  type QuestionPack,
} from './core'

const isoDate = z.iso.datetime({ offset: true, message: 'must be an ISO date like 2026-09-25T18:30:00.000Z' })
const id = z.string().regex(ID_PATTERN, 'must be lowercase letters, digits and dashes')
const depth = z.union([z.literal(1), z.literal(2), z.literal(3)], { message: 'must be 1, 2 or 3' })
const topic = z.enum(INTERVIEW_TOPIC_IDS, { message: `must be one of ${INTERVIEW_TOPIC_IDS.join(', ')}` })
const questionType = z.enum(QUESTION_TYPES, { message: `must be one of ${QUESTION_TYPES.join(', ')}` })
const options = z.tuple([z.string().trim().min(1), z.string().trim().min(1)], { message: 'must be exactly two choices' })
const scale = z
  .object({ min: z.number(), max: z.number(), minLabel: z.string(), maxLabel: z.string() })
  .refine((s) => s.min < s.max, { message: 'min must be less than max' })

const questionShape = {
  id,
  topic,
  type: questionType,
  prompt: z.string().trim().min(1, 'is missing').max(MAX_PROMPT_CHARS),
  hint: z.string().optional(),
  followUps: z.array(z.string()).optional(),
  depth,
  why: z.string().trim().min(1, 'is missing (say what the clone learns)'),
  options: options.optional(),
  scale: scale.optional(),
}

function typeRules(q: { type: string; options?: unknown; scale?: unknown }, ctx: z.RefinementCtx): void {
  if (q.type === 'this-or-that' && !q.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'this-or-that needs exactly two options' })
  if (q.type === 'scale' && !q.scale) ctx.addIssue({ code: 'custom', path: ['scale'], message: 'scale questions need { min, max, minLabel, maxLabel }' })
}

/** One question, as in content/questions. Used by the bank integrity test and packs. */
export const questionSchema = z.object(questionShape).superRefine(typeRules)

// ── Question pack ─────────────────────────────────────────────────────────────

export const packQuestionSchema = z
  .object({ ...questionShape, basedOn: z.array(z.string()).optional() })
  .superRefine(typeRules)

export const questionPackSchema = z
  .object({
    format: z.literal(PACK_FORMAT),
    version: z.literal(1),
    packId: id,
    title: z.string().trim().min(1, 'is missing'),
    createdAt: isoDate,
    note: z.string().optional(),
    questions: z.array(packQuestionSchema).min(1, 'must have at least one question').max(200),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>()
    pack.questions.forEach((q, i) => {
      if (seen.has(q.id)) ctx.addIssue({ code: 'custom', path: ['questions', i, 'id'], message: `duplicate id ${q.id}` })
      seen.add(q.id)
    })
  })

// ── Answers export ────────────────────────────────────────────────────────────

const text = z.string().max(MAX_ANSWER_CHARS, `is longer than ${MAX_ANSWER_CHARS} characters`)

export const exportAnswerSchema = z
  .object({
    qid: id,
    source: z.enum(['bank', 'pack', 'custom']),
    packId: z.string().optional(),
    topic,
    type: questionType,
    depth,
    prompt: z.string().trim().min(1, 'is missing').max(MAX_PROMPT_CHARS),
    hint: z.string().optional(),
    followUps: z.array(z.string()).optional(),
    why: z.string().optional(),
    options: options.optional(),
    scale: scale.optional(),
    answer: z.object({
      text,
      choice: z.string().nullable().optional(),
      value: z.number().nullable().optional(),
      parts: z
        .object({ situation: text.optional(), action: text.optional(), result: text.optional(), lesson: text.optional() })
        .nullable()
        .optional(),
    }),
    starred: z.boolean(),
    answeredAt: isoDate,
    updatedAt: isoDate,
    wordCount: z.number().int().min(0),
  })
  .superRefine((a, ctx) => {
    if (a.source === 'custom' && !a.qid.startsWith('custom-')) {
      ctx.addIssue({ code: 'custom', path: ['qid'], message: 'custom cards need an id starting with "custom-"' })
    }
    if (a.type === 'this-or-that') {
      if (!a.options) ctx.addIssue({ code: 'custom', path: ['options'], message: 'this-or-that needs exactly two options' })
      else if (a.answer.choice && !a.options.includes(a.answer.choice)) {
        ctx.addIssue({ code: 'custom', path: ['answer', 'choice'], message: `"${a.answer.choice}" is not one of the options (${a.options.join(' / ')})` })
      }
    }
    if (a.type === 'scale') {
      if (!a.scale) ctx.addIssue({ code: 'custom', path: ['scale'], message: 'scale questions need { min, max, minLabel, maxLabel }' })
      else if (typeof a.answer.value === 'number' && (a.answer.value < a.scale.min || a.answer.value > a.scale.max)) {
        ctx.addIssue({ code: 'custom', path: ['answer', 'value'], message: `must be between ${a.scale.min} and ${a.scale.max}` })
      }
    }
  })

export const answersExportSchema = z.object({
  format: z.literal(ANSWERS_FORMAT),
  version: z.literal(1),
  exportedAt: isoDate,
  scope: z.enum(['all', 'since-last-export']),
  since: isoDate.nullable(),
  bankVersion: z.string(),
  stats: z.object({
    answered: z.number(),
    exported: z.number(),
    xp: z.number(),
    level: z.string(),
    fidelity: z.number(),
    streakDays: z.number(),
  }),
  answers: z.array(exportAnswerSchema).max(5_000),
})

export type ParsedExport = z.infer<typeof answersExportSchema>
export type ParsedPack = z.infer<typeof questionPackSchema>

// ── Friendly parsing ──────────────────────────────────────────────────────────

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] }

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

/** "Card 4 (principles-004 · "What will you never…"): answer.value must be between 1 and 5" */
function describe(issue: z.core.$ZodIssue, input: unknown, listKey: 'answers' | 'questions'): string {
  const path = issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p))
  const field = (rest: (string | number)[]): string => (rest.length ? `${rest.join('.')} ` : '')
  if (path[0] === listKey && typeof path[1] === 'number') {
    const list = isObj(input) && Array.isArray(input[listKey]) ? (input[listKey] as unknown[]) : []
    const item = list[path[1]]
    const itemId = isObj(item) ? (listKey === 'answers' ? item.qid : item.id) : undefined
    const prompt = isObj(item) && typeof item.prompt === 'string' ? ` · "${clip(item.prompt, 50)}"` : ''
    const label = listKey === 'answers' ? 'Card' : 'Question'
    const who = `${label} ${path[1] + 1}${typeof itemId === 'string' ? ` (${itemId}${prompt})` : prompt ? ` (${prompt.slice(3)})` : ''}`
    return `${who}: ${field(path.slice(2))}${issue.message}`
  }
  return path.length ? `${path.join('.')}: ${issue.message}` : issue.message
}

function formatMismatch(input: unknown, expected: string): string | null {
  if (!isObj(input)) return 'This file is not a JSON object.'
  if (input.format === expected) return null
  const got = typeof input.format === 'string' ? `"${input.format}"` : 'missing'
  const known: Record<string, string> = {
    [ANSWERS_FORMAT]: 'This is an answers export from the interview stack.',
    [PACK_FORMAT]: 'This is a question pack: import it into interview/raj-interview.html with "Import question pack".',
    'raj-clone-stack-backup': 'This is a full stack backup: restore it in the HTML, or export answers from there instead.',
  }
  return `Expected a "${expected}" file but its format is ${got}. ${typeof input.format === 'string' ? (known[input.format] ?? '') : ''}`.trim()
}

/** Validate an answers export, returning friendly errors that name the card and the problem. */
export function parseExport(input: unknown): ParseResult<ParsedExport> {
  const mismatch = formatMismatch(input, ANSWERS_FORMAT)
  if (mismatch) return { ok: false, errors: [mismatch] }
  const r = answersExportSchema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, errors: r.error.issues.slice(0, 25).map((i) => describe(i, input, 'answers')) }
}

/** Validate a question pack the same way. */
export function parsePack(input: unknown): ParseResult<ParsedPack> {
  const mismatch = formatMismatch(input, PACK_FORMAT)
  if (mismatch) return { ok: false, errors: [mismatch] }
  const r = questionPackSchema.safeParse(input)
  if (r.success) return { ok: true, data: r.data }
  return { ok: false, errors: r.error.issues.slice(0, 25).map((i) => describe(i, input, 'questions')) }
}

// ── Keep core's TypeScript shapes and these schemas in lockstep ───────────────

type Assignable<From extends To, To> = [From, To]
export type _CoreExportMatchesSchema = Assignable<AnswersExport, z.input<typeof answersExportSchema>>
export type _SchemaExportMatchesCore = Assignable<Omit<ParsedExport, 'answers'>, Omit<AnswersExport, 'answers'>>
export type _CorePackMatchesSchema = Assignable<QuestionPack, z.input<typeof questionPackSchema>>
