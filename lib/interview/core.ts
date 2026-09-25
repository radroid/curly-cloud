/**
 * The interview stack's shared core: state shape, scoring (XP, richness, fidelity, badges), export
 * building and question-pack checks.
 *
 * It runs in two places from ONE definition:
 *   - interview/raj-interview.html: scripts/build-interview.ts transpiles this file to plain JS
 *     (no bundler) and inlines it as `window.StackCore`.
 *   - lib/interview + tests, where the export it builds is validated by the zod schema.
 *
 * So: no runtime imports (`import type` only), no Node or DOM APIs, no dates read implicitly.
 * Callers pass `now` and the local hour in.
 */
import type { InterviewTopicId, Question, QuestionType, ScaleSpec } from '@/content/questions/types'

export const ANSWERS_FORMAT = 'raj-clone-answers'
export const PACK_FORMAT = 'raj-clone-question-pack'
export const BACKUP_FORMAT = 'raj-clone-stack-backup'

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,79}$/
export const MAX_PROMPT_CHARS = 1_000
export const MAX_ANSWER_CHARS = 40_000

// ── Shapes ────────────────────────────────────────────────────────────────────

export type CardSource = 'bank' | 'pack' | 'custom'

/** Anything the stack can show: a bank question, a card from an imported pack, or one Raj wrote. */
export interface StackCard extends Question {
  source: CardSource
  packId?: string
  /** Pack questions: the answer ids that prompted the follow-up. */
  basedOn?: string[]
  createdAt?: string
}

export interface StoryParts {
  situation?: string
  action?: string
  result?: string
  lesson?: string
}

export interface AnswerBody {
  /** The main answer, or the "why" for this-or-that and scale. */
  text: string
  /** this-or-that: the option picked (one of `options`). */
  choice?: string | null
  /** scale: the value picked. */
  value?: number | null
  /** story: optional scaffold fields, merged into the answer on export. */
  parts?: StoryParts | null
}

export interface AnswerRecord extends AnswerBody {
  answeredAt: string
  updatedAt: string
}

export interface CardFlags {
  starred?: boolean
  snoozedAt?: string | null
  skippedAt?: string | null
}

export interface PackRecord {
  packId: string
  title: string
  note?: string
  importedAt: string
  added: number
}

export interface StackState {
  version: 1
  createdAt: string
  answers: Record<string, AnswerRecord>
  flags: Record<string, CardFlags>
  custom: StackCard[]
  packCards: StackCard[]
  packs: PackRecord[]
  /** badge id → earnedAt */
  badges: Record<string, string>
  /** Local days (YYYY-MM-DD) with at least one saved answer. */
  activeDays: string[]
  bonusXp: number
  lightning: { best: number; rounds: number }
  lastExportAt: string | null
  exports: number
}

export interface ExportAnswer {
  qid: string
  source: CardSource
  packId?: string
  topic: InterviewTopicId
  type: QuestionType
  depth: 1 | 2 | 3
  prompt: string
  hint?: string
  followUps?: string[]
  why?: string
  options?: [string, string]
  scale?: ScaleSpec
  answer: AnswerBody
  starred: boolean
  answeredAt: string
  updatedAt: string
  wordCount: number
}

export interface AnswersExport {
  format: typeof ANSWERS_FORMAT
  version: 1
  exportedAt: string
  scope: 'all' | 'since-last-export'
  since: string | null
  bankVersion: string
  stats: { answered: number; exported: number; xp: number; level: string; fidelity: number; streakDays: number }
  answers: ExportAnswer[]
}

export interface PackQuestion extends Question {
  basedOn?: string[]
}

export interface QuestionPack {
  format: typeof PACK_FORMAT
  version: 1
  packId: string
  title: string
  createdAt: string
  note?: string
  questions: PackQuestion[]
}

export interface StackBackup {
  format: typeof BACKUP_FORMAT
  version: 1
  savedAt: string
  bankVersion: string
  state: StackState
}

// ── State ─────────────────────────────────────────────────────────────────────

export function emptyState(now: string): StackState {
  return {
    version: 1,
    createdAt: now,
    answers: {},
    flags: {},
    custom: [],
    packCards: [],
    packs: [],
    badges: {},
    activeDays: [],
    bonusXp: 0,
    lightning: { best: 0, rounds: 0 },
    lastExportAt: null,
    exports: 0,
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Load whatever localStorage or a backup held, keeping everything valid and dropping the rest. */
export function normalizeState(raw: unknown, now: string): StackState {
  const base = emptyState(now)
  if (!isObj(raw)) return base
  base.createdAt = str(raw.createdAt, now)
  if (isObj(raw.answers)) {
    for (const [id, a] of Object.entries(raw.answers)) {
      if (!isObj(a)) continue
      const rec: AnswerRecord = {
        text: str(a.text),
        answeredAt: str(a.answeredAt, now),
        updatedAt: str(a.updatedAt, str(a.answeredAt, now)),
      }
      if (typeof a.choice === 'string') rec.choice = a.choice
      if (typeof a.value === 'number' && Number.isFinite(a.value)) rec.value = a.value
      if (isObj(a.parts)) {
        const parts: StoryParts = {}
        for (const k of STORY_PART_KEYS) if (typeof a.parts[k] === 'string') parts[k] = a.parts[k] as string
        rec.parts = parts
      }
      base.answers[id] = rec
    }
  }
  if (isObj(raw.flags)) {
    for (const [id, f] of Object.entries(raw.flags)) {
      if (!isObj(f)) continue
      const flag: CardFlags = {}
      if (f.starred === true) flag.starred = true
      if (typeof f.snoozedAt === 'string') flag.snoozedAt = f.snoozedAt
      if (typeof f.skippedAt === 'string') flag.skippedAt = f.skippedAt
      base.flags[id] = flag
    }
  }
  const cards = (v: unknown, source: CardSource): StackCard[] =>
    Array.isArray(v) ? v.filter((c): c is StackCard => isObj(c) && typeof c.id === 'string' && typeof c.prompt === 'string').map((c) => ({ ...c, source })) : []
  base.custom = cards(raw.custom, 'custom')
  base.packCards = cards(raw.packCards, 'pack')
  if (Array.isArray(raw.packs)) base.packs = raw.packs.filter((p): p is PackRecord => isObj(p) && typeof p.packId === 'string')
  if (isObj(raw.badges)) {
    for (const [id, at] of Object.entries(raw.badges)) if (typeof at === 'string') base.badges[id] = at
  }
  if (Array.isArray(raw.activeDays)) base.activeDays = raw.activeDays.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
  base.bonusXp = Math.max(0, num(raw.bonusXp))
  if (isObj(raw.lightning)) base.lightning = { best: num(raw.lightning.best), rounds: num(raw.lightning.rounds) }
  base.lastExportAt = typeof raw.lastExportAt === 'string' ? raw.lastExportAt : null
  base.exports = num(raw.exports)
  return base
}

/** Bank questions plus pack and custom cards, in stack order. Pack/custom ids never shadow the bank. */
export function allCards(bank: Question[], state: StackState): StackCard[] {
  const seen = new Set<string>()
  const out: StackCard[] = []
  for (const q of bank) {
    seen.add(q.id)
    out.push({ ...q, source: 'bank' })
  }
  for (const c of [...state.packCards, ...state.custom]) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

// ── Answers ───────────────────────────────────────────────────────────────────

export const STORY_PART_KEYS = ['situation', 'action', 'result', 'lesson'] as const
export const STORY_PART_LABELS: Record<(typeof STORY_PART_KEYS)[number], string> = {
  situation: 'Situation',
  action: 'What I did',
  result: 'What happened',
  lesson: "What I'd do differently",
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0
  const m = text.trim().match(/[^\s]+/g)
  return m ? m.length : 0
}

/** All the prose in an answer: the main text plus any story scaffold fields. */
export function answerProse(a: AnswerBody | null | undefined): string {
  if (!a) return ''
  const parts = a.parts ? STORY_PART_KEYS.map((k) => (a.parts?.[k] ?? '').trim()).filter(Boolean) : []
  return [a.text.trim(), ...parts].filter(Boolean).join('\n\n')
}

export function answerWordCount(a: AnswerBody | null | undefined): number {
  return countWords(answerProse(a))
}

export function isAnswerEmpty(a: AnswerBody | null | undefined): boolean {
  if (!a) return true
  if (answerProse(a) !== '') return false
  if (typeof a.choice === 'string' && a.choice !== '') return false
  if (typeof a.value === 'number' && Number.isFinite(a.value)) return false
  return true
}

export function isAnswered(state: StackState, id: string): boolean {
  return !isAnswerEmpty(state.answers[id])
}

// ── Richness: rewards specifics, not length ───────────────────────────────────

const TOOL_WORDS = [
  'claude', 'claude code', 'copilot', 'mcp', 'rag', 'llm', 'llms', 'agent', 'agents', 'eval', 'evals', 'inspect', 'langchain',
  'openai', 'anthropic', 'gpt', 'embedding', 'embeddings', 'reranker', 'rrf', 'bm25', 'pgvector', 'qdrant', 'supabase',
  'postgres', 'postgresql', 'sql', 'sqlite', 'kafka', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'cloudflare',
  'lambda', 'ecs', 's3', 'cdk', 'terraform', 'ci/cd', 'github', 'git', 'next.js', 'nextjs', 'react', 'node', 'typescript',
  'javascript', 'python', 'c#', '.net', 'excel', 'jira', 'linear', 'slack', 'notion', 'figma', 'lorawan', 'vitest', 'jest',
  'playwright', 'redis', 'grafana', 'datadog', 'sentry', 'vscode', 'vim', 'cursor',
]
const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|fifty|hundred|thousand|million|dozen|half|twice|doubled|tripled)\b/i
const DIGITS = /\d/
const EXAMPLE = /\b(for example|for instance|e\.g\.|one time|once,|i remember|last (week|month|year|quarter)|at (eddy|pinhous|aro|duit|create club|brainstation|durham|manchester)|when i was|there was a time|the day|that week|in 20\d\d)\b/i
const REASONING = /\b(because|so that|which meant|the reason|trade-?offs?|instead of|rather than|otherwise|the cost|the risk|in exchange)\b/i
const REFLECTION = /\b(i learned|i learnt|i realised|i realized|in hindsight|looking back|next time|i'd do|i would do|i'd change|i would change|i was wrong|i felt|i was scared|proud|frustrat|embarrass|surprised me)\b/i

export interface Richness {
  /** 0..1 */
  score: number
  /** 0..4 */
  level: number
  label: string
  tip: string | null
  signals: { words: number; numbers: boolean; names: boolean; example: boolean; reasoning: boolean; reflection: boolean }
}

export const RICHNESS_LABELS = ['Thin', 'Sketch', 'Specific', 'Vivid', 'Gold']

function hasNames(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `
  for (const w of TOOL_WORDS) {
    const re = new RegExp(`[^a-z0-9]${w.replace(/[.*+?^${}()|[\]\\/#]/g, '\\$&')}[^a-z0-9]`)
    if (re.test(lower)) return true
  }
  // A capitalised word mid-sentence is usually a person, company, place or product.
  return /[a-z,;:]\s+(?!I\b|I'|I’)[A-Z][a-zA-Z0-9]+/.test(text)
}

export function richness(text: string): Richness {
  const words = countWords(text)
  const signals = {
    words,
    numbers: DIGITS.test(text) || NUMBER_WORDS.test(text),
    names: hasNames(text),
    example: EXAMPLE.test(text),
    reasoning: REASONING.test(text),
    reflection: REFLECTION.test(text),
  }
  if (words === 0) return { score: 0, level: 0, label: RICHNESS_LABELS[0], tip: null, signals }
  // Length is at most 30% of the score; the rest comes from specifics.
  const lengthScore = words < 8 ? 0.03 : Math.min(0.3, 0.06 + (Math.log(words / 8) / Math.log(150 / 8)) * 0.24)
  let score =
    lengthScore +
    (signals.numbers ? 0.15 : 0) +
    (signals.names ? 0.15 : 0) +
    (signals.example ? 0.15 : 0) +
    (signals.reasoning ? 0.15 : 0) +
    (signals.reflection ? 0.1 : 0)
  // Specifics without substance don't count for much.
  if (words < 15) score = Math.min(score, 0.34)
  score = Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  const level = score >= 0.75 ? 4 : score >= 0.55 ? 3 : score >= 0.35 ? 2 : score >= 0.15 ? 1 : 0
  let tip: string | null = null
  if (words < 15) tip = 'Keep going: a few sentences in your own words.'
  else if (!signals.example) tip = 'Add a concrete example: when, where, who.'
  else if (!signals.numbers) tip = 'Add a number: how many, how long, how much.'
  else if (!signals.names) tip = 'Name the tool, team, place or person.'
  else if (!signals.reasoning) tip = 'Say why: what was the trade-off?'
  else if (!signals.reflection) tip = 'What would you do differently now?'
  return { score, level, label: RICHNESS_LABELS[level], tip, signals }
}

// ── XP and levels ─────────────────────────────────────────────────────────────

export const TYPE_XP: Record<QuestionType, number> = { rapid: 5, 'this-or-that': 10, scale: 10, open: 20, scenario: 25, story: 30 }
const DEPTH_MULT: Record<number, number> = { 1: 1, 2: 1.5, 3: 2 }

/** XP for one answer: type × depth × substance. Substance comes from specifics, not raw length. */
export function xpFor(card: Pick<Question, 'type' | 'depth'>, a: AnswerBody | null | undefined): number {
  if (!a || isAnswerEmpty(a)) return 0
  const base = TYPE_XP[card.type] ?? 10
  const depth = DEPTH_MULT[card.depth] ?? 1
  let substance: number
  if (card.type === 'rapid') substance = 1
  else if (card.type === 'this-or-that' || card.type === 'scale') {
    const picked = card.type === 'this-or-that' ? !!a.choice : typeof a.value === 'number'
    const why = answerProse(a)
    substance = (picked ? 0.5 : 0) + (countWords(why) >= 4 ? 0.2 + richness(why).score : 0)
  } else {
    const prose = answerProse(a)
    substance = countWords(prose) < 5 ? 0.25 : 0.5 + richness(prose).score
  }
  return Math.max(1, Math.round(base * depth * substance))
}

export interface Level {
  index: number
  name: string
  tagline: string
  min: number
  next: number | null
}

export const LEVELS: { name: string; tagline: string; min: number }[] = [
  { name: 'Punch Card', tagline: '80 columns of Raj.', min: 0 },
  { name: 'Floppy', tagline: '400K of opinions.', min: 60 },
  { name: 'Hard Disk', tagline: 'A whole 20 MB. Room to think.', min: 200 },
  { name: 'Macintosh', tagline: 'Hello. It is me.', min: 450 },
  { name: 'LaserWriter', tagline: 'Printing in full sentences.', min: 850 },
  { name: 'Mainframe', tagline: 'Time-sharing your brain.', min: 1400 },
  { name: 'Supercomputer', tagline: 'Now in teraflops.', min: 2200 },
  { name: 'Neural Net', tagline: 'The weights are warming up.', min: 3300 },
  { name: 'Foundation Model', tagline: 'Pre-trained on pure Raj.', min: 4800 },
  { name: 'Actual Raj', tagline: 'Indistinguishable. Mostly.', min: 6500 },
]

export function levelFor(xp: number): Level {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++
  const l = LEVELS[i]
  return { index: i, name: l.name, tagline: l.tagline, min: l.min, next: i + 1 < LEVELS.length ? LEVELS[i + 1].min : null }
}

export function totalXp(state: StackState, cards: StackCard[]): number {
  let xp = state.bonusXp
  for (const c of cards) xp += xpFor(c, state.answers[c.id])
  return xp
}

// ── Coverage and fidelity ─────────────────────────────────────────────────────

export interface Coverage {
  answered: number
  total: number
  /** Depth-weighted share of the topic answered, 0..1. */
  weighted: number
}

export function coverage(state: StackState, cards: StackCard[]): Coverage {
  let answered = 0
  let w = 0
  let wAnswered = 0
  for (const c of cards) {
    w += c.depth
    if (isAnswered(state, c.id)) {
      answered++
      wAnswered += c.depth
    }
  }
  return { answered, total: cards.length, weighted: w ? wAnswered / w : 0 }
}

/**
 * How well the clone could stand in for Raj, 0..1: depth-weighted coverage of the question
 * bank and packs, where each answer counts for 60–100% depending on how specific it is.
 * Custom cards are a bonus (they add knowledge, not coverage) and are ignored here.
 */
export function fidelity(state: StackState, cards: StackCard[]): number {
  let w = 0
  let got = 0
  for (const c of cards) {
    if (c.source === 'custom') continue
    w += c.depth
    const a = state.answers[c.id]
    if (isAnswerEmpty(a)) continue
    const quality = c.type === 'rapid' ? 1 : 0.6 + 0.4 * Math.min(1, richness(answerProse(a)).score / 0.75)
    got += c.depth * quality
  }
  return w ? Math.round((got / w) * 1000) / 1000 : 0
}

// ── Streaks ───────────────────────────────────────────────────────────────────

/** Local calendar day for a Date, e.g. "2026-09-25". */
export function localDayKey(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return dt.toISOString().slice(0, 10)
}

/** Consecutive active days ending today (or yesterday, so the streak survives until you answer today). */
export function currentStreak(activeDays: string[], today: string): number {
  const set = new Set(activeDays)
  let day = set.has(today) ? today : shiftDay(today, -1)
  let n = 0
  while (set.has(day)) {
    n++
    day = shiftDay(day, -1)
  }
  return n
}

// ── Badges ────────────────────────────────────────────────────────────────────

export interface BadgeDef {
  id: string
  name: string
  desc: string
}

export const BADGES: BadgeDef[] = [
  { id: 'first-card', name: 'First Card', desc: 'Answer your first card.' },
  { id: 'storyteller', name: 'Storyteller', desc: 'Answer 5 story cards.' },
  { id: 'opinionated', name: 'Opinionated', desc: 'Answer 10 this-or-that cards.' },
  { id: 'deep-diver', name: 'Deep Diver', desc: 'Write a 300+ word answer.' },
  { id: 'lightning-rod', name: 'Lightning Rod', desc: 'Answer 10 in one lightning round.' },
  { id: 'scenario-solver', name: 'Scenario Solver', desc: 'Answer 8 scenario cards.' },
  { id: 'philosopher', name: 'Philosopher', desc: 'Answer every Principles card.' },
  { id: 'full-stack', name: 'Full Stack', desc: 'Answer at least one card in every topic.' },
  { id: 'night-owl', name: 'Night Owl', desc: 'Save an answer between midnight and 5 am.' },
  { id: 'early-bird', name: 'Early Bird', desc: 'Save an answer between 5 and 8 am.' },
  { id: 'bookworm', name: 'Bookworm', desc: 'Answer 50 cards.' },
  { id: 'on-a-roll', name: 'On a Roll', desc: 'Answer on 3 days in a row.' },
  { id: 'half-raj', name: 'Fidelity 50%', desc: 'Reach 50% clone fidelity.' },
  { id: 'fed-the-clone', name: 'Fed the Clone', desc: 'Export answers for the agent.' },
]

export interface BadgeContext {
  /** Local hour (0–23) when an answer was just saved; omit when nothing was saved. */
  savedAtHour?: number
  /** Answers in the lightning round that just ended. */
  lightningRun?: number
  today: string
}

/** Badge ids newly earned in this state. Doesn't mutate. */
export function newBadges(state: StackState, cards: StackCard[], ctx: BadgeContext): string[] {
  const answered = cards.filter((c) => isAnswered(state, c.id))
  const ofType = (t: QuestionType): number => answered.filter((c) => c.type === t).length
  const topicsWithCards = new Set(cards.filter((c) => c.source === 'bank').map((c) => c.topic))
  const topicsTouched = new Set(answered.map((c) => c.topic))
  const principles = cards.filter((c) => c.topic === 'principles' && c.source === 'bank')
  const checks: Record<string, boolean> = {
    'first-card': answered.length >= 1,
    storyteller: ofType('story') >= 5,
    opinionated: ofType('this-or-that') >= 10,
    'deep-diver': answered.some((c) => answerWordCount(state.answers[c.id]) >= 300),
    'lightning-rod': (ctx.lightningRun ?? 0) >= 10,
    'scenario-solver': ofType('scenario') >= 8,
    philosopher: principles.length > 0 && principles.every((c) => isAnswered(state, c.id)),
    'full-stack': topicsWithCards.size > 0 && [...topicsWithCards].every((t) => topicsTouched.has(t)),
    'night-owl': ctx.savedAtHour !== undefined && ctx.savedAtHour >= 0 && ctx.savedAtHour < 5,
    'early-bird': ctx.savedAtHour !== undefined && ctx.savedAtHour >= 5 && ctx.savedAtHour < 8,
    bookworm: answered.length >= 50,
    'on-a-roll': currentStreak(state.activeDays, ctx.today) >= 3,
    'half-raj': fidelity(state, cards) >= 0.5,
    'fed-the-clone': state.exports >= 1,
  }
  return BADGES.filter((b) => checks[b.id] && !state.badges[b.id]).map((b) => b.id)
}

// ── Export ────────────────────────────────────────────────────────────────────

export function unexportedIds(state: StackState, cards: StackCard[]): string[] {
  return cards
    .filter((c) => isAnswered(state, c.id))
    .filter((c) => !state.lastExportAt || state.answers[c.id].updatedAt > state.lastExportAt)
    .map((c) => c.id)
}

function cleanAnswer(card: StackCard, a: AnswerRecord): AnswerBody {
  const out: AnswerBody = { text: a.text.trim() }
  if (card.type === 'this-or-that' && a.choice) out.choice = a.choice
  if (card.type === 'scale' && typeof a.value === 'number') out.value = a.value
  if (a.parts) {
    const parts: StoryParts = {}
    for (const k of STORY_PART_KEYS) {
      const v = (a.parts[k] ?? '').trim()
      if (v) parts[k] = v
    }
    if (Object.keys(parts).length) out.parts = parts
  }
  return out
}

/**
 * Build a `raj-clone-answers` v1 export. The HTML's Export button calls exactly this, and the
 * server validates the result with `lib/interview/schema.ts`.
 */
export function buildExport(
  state: StackState,
  cards: StackCard[],
  opts: { scope: 'all' | 'since-last-export'; now: string; bankVersion: string; today: string },
): AnswersExport {
  const since = opts.scope === 'since-last-export' ? state.lastExportAt : null
  const answers: ExportAnswer[] = []
  let answered = 0
  for (const c of cards) {
    const a = state.answers[c.id]
    if (isAnswerEmpty(a)) continue
    answered++
    if (since && a.updatedAt <= since) continue
    const item: ExportAnswer = {
      qid: c.id,
      source: c.source,
      topic: c.topic,
      type: c.type,
      depth: c.depth,
      prompt: c.prompt,
      answer: cleanAnswer(c, a),
      starred: state.flags[c.id]?.starred === true,
      answeredAt: a.answeredAt,
      updatedAt: a.updatedAt,
      wordCount: answerWordCount(a),
    }
    if (c.packId) item.packId = c.packId
    if (c.hint) item.hint = c.hint
    if (c.followUps?.length) item.followUps = c.followUps
    if (c.why) item.why = c.why
    if (c.type === 'this-or-that' && c.options) item.options = [c.options[0], c.options[1]]
    if (c.type === 'scale' && c.scale) item.scale = { ...c.scale }
    answers.push(item)
  }
  const xp = totalXp(state, cards)
  return {
    format: ANSWERS_FORMAT,
    version: 1,
    exportedAt: opts.now,
    scope: opts.scope,
    since,
    bankVersion: opts.bankVersion,
    stats: {
      answered,
      exported: answers.length,
      xp,
      level: levelFor(xp).name,
      fidelity: fidelity(state, cards),
      streakDays: currentStreak(state.activeDays, opts.today),
    },
    answers,
  }
}

/** `raj-clone-answers-2026-09-25.json` */
export function exportFileName(today: string, kind: 'answers' | 'backup' = 'answers'): string {
  return kind === 'answers' ? `raj-clone-answers-${today}.json` : `raj-clone-stack-backup-${today}.json`
}

// ── Question packs (light check for the browser; the zod schema is authoritative) ──

export interface PackCheck {
  ok: boolean
  errors: string[]
  pack: QuestionPack | null
}

function describeQuestion(i: number, q: unknown): string {
  const id = isObj(q) && typeof q.id === 'string' ? ` (${q.id})` : ''
  return `Question ${i + 1}${id}`
}

/** Check one question against the bank's rules. Returns friendly problems, empty when fine. */
export function questionProblems(q: unknown, topics: readonly string[], types: readonly string[]): string[] {
  const p: string[] = []
  if (!isObj(q)) return ['is not an object']
  if (typeof q.id !== 'string' || !ID_PATTERN.test(q.id)) p.push('id must be lowercase letters, digits and dashes (e.g. followup-20260925-01)')
  if (typeof q.topic !== 'string' || !topics.includes(q.topic)) p.push(`topic must be one of ${topics.join(', ')}`)
  if (typeof q.type !== 'string' || !types.includes(q.type)) p.push(`type must be one of ${types.join(', ')}`)
  if (typeof q.prompt !== 'string' || !q.prompt.trim()) p.push('prompt is missing')
  else if (q.prompt.length > MAX_PROMPT_CHARS) p.push(`prompt is longer than ${MAX_PROMPT_CHARS} characters`)
  if (q.depth !== 1 && q.depth !== 2 && q.depth !== 3) p.push('depth must be 1, 2 or 3')
  if (typeof q.why !== 'string' || !q.why.trim()) p.push('why is missing (say what the clone learns)')
  if (q.hint !== undefined && typeof q.hint !== 'string') p.push('hint must be text')
  if (q.followUps !== undefined && !(Array.isArray(q.followUps) && q.followUps.every((f) => typeof f === 'string'))) {
    p.push('followUps must be a list of text')
  }
  if (q.type === 'this-or-that') {
    if (!(Array.isArray(q.options) && q.options.length === 2 && q.options.every((o) => typeof o === 'string' && o.trim()))) {
      p.push('this-or-that needs options: exactly two choices')
    }
  }
  if (q.type === 'scale') {
    const s = q.scale
    if (!(isObj(s) && typeof s.min === 'number' && typeof s.max === 'number' && s.min < s.max && typeof s.minLabel === 'string' && typeof s.maxLabel === 'string')) {
      p.push('scale needs { min, max, minLabel, maxLabel } with min < max')
    }
  }
  return p
}

export function checkPack(json: unknown, topics: readonly string[], types: readonly string[]): PackCheck {
  const errors: string[] = []
  if (!isObj(json)) return { ok: false, errors: ['This file is not a JSON object.'], pack: null }
  if (json.format !== PACK_FORMAT) {
    const got = typeof json.format === 'string' ? `"${json.format}"` : 'missing'
    const hint = json.format === ANSWERS_FORMAT ? ' This is an answers export: give it to the agent, not the stack.' : ''
    return { ok: false, errors: [`Not a question pack (format is ${got}, expected "${PACK_FORMAT}").${hint}`], pack: null }
  }
  if (json.version !== 1) errors.push(`Unsupported pack version ${String(json.version)} (expected 1).`)
  if (typeof json.packId !== 'string' || !ID_PATTERN.test(json.packId)) errors.push('packId must be lowercase letters, digits and dashes.')
  if (typeof json.title !== 'string' || !json.title.trim()) errors.push('title is missing.')
  if (!Array.isArray(json.questions) || json.questions.length === 0) errors.push('questions must be a non-empty list.')
  else {
    const ids = new Set<string>()
    json.questions.forEach((q, i) => {
      for (const problem of questionProblems(q, topics, types)) errors.push(`${describeQuestion(i, q)}: ${problem}.`)
      if (isObj(q) && typeof q.id === 'string') {
        if (ids.has(q.id)) errors.push(`${describeQuestion(i, q)}: duplicate id in this pack.`)
        ids.add(q.id)
      }
    })
  }
  return errors.length ? { ok: false, errors, pack: null } : { ok: true, errors, pack: json as unknown as QuestionPack }
}

/** Turn a checked pack into new cards, skipping ids the stack already has. */
export function packToCards(pack: QuestionPack, existingIds: Set<string>): { cards: StackCard[]; duplicates: string[] } {
  const cards: StackCard[] = []
  const duplicates: string[] = []
  for (const q of pack.questions) {
    if (existingIds.has(q.id)) {
      duplicates.push(q.id)
      continue
    }
    const card: StackCard = {
      id: q.id,
      topic: q.topic as InterviewTopicId,
      type: q.type,
      prompt: q.prompt.trim(),
      depth: q.depth,
      why: q.why,
      source: 'pack',
      packId: pack.packId,
    }
    if (q.hint) card.hint = q.hint
    if (q.followUps?.length) card.followUps = q.followUps
    if (q.options) card.options = [q.options[0], q.options[1]]
    if (q.scale) card.scale = { ...q.scale }
    if (q.basedOn?.length) card.basedOn = q.basedOn
    cards.push(card)
  }
  return { cards, duplicates }
}

// ── Backup ────────────────────────────────────────────────────────────────────

export function buildBackup(state: StackState, now: string, bankVersion: string): StackBackup {
  return { format: BACKUP_FORMAT, version: 1, savedAt: now, bankVersion, state }
}

export function checkBackup(json: unknown, now: string): { ok: true; state: StackState } | { ok: false; error: string } {
  if (!isObj(json)) return { ok: false, error: 'This file is not a JSON object.' }
  if (json.format !== BACKUP_FORMAT) {
    const got = typeof json.format === 'string' ? `"${json.format}"` : 'missing'
    return { ok: false, error: `Not a stack backup (format is ${got}, expected "${BACKUP_FORMAT}").` }
  }
  if (json.version !== 1 || !isObj(json.state)) return { ok: false, error: 'This backup is from an unknown version.' }
  return { ok: true, state: normalizeState(json.state, now) }
}
