/**
 * One eval case: retrieval ranks / hit@k / reciprocal rank, and (for answer-type cases) the
 * generated answer with its checks. Shapes are documented in evals/README.md.
 */
import { z } from 'zod'
import type { AppEnv } from '@/lib/env'
import { collectAnswer, RagError } from '@/lib/rag/answer'
import { retrievalQuery, retrieveChunks } from '@/lib/rag/retrieve'
import { signTurns, turnSecret } from '@/lib/rag/turns'
import type { ChatTurn } from '@/lib/rag/types'

export type EvalKind = 'retrieval' | 'answer' | 'refusal' | 'injection'

export interface EvalCase {
  id: string
  kind: EvalKind
  question: string
  /** Earlier turns, for follow-up questions. */
  history?: ChatTurn[]
  /** Source-id prefixes that count as relevant, e.g. "resume:exp:eddy". */
  expect?: string[]
  /** Each entry must appear (case-insensitive). "a|b" means either a or b. */
  mustInclude?: string[]
  /** None of these may appear (case-insensitive substrings). */
  mustNotInclude?: string[]
  /** None of these regular expressions (case-insensitive) may match. */
  mustNotMatch?: string[]
  /** The answer must cite at least one source. */
  mustCite?: boolean
  /** Retrieval depth to score (default 8). */
  k?: number
  notes?: string
}

const Turn = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) })

/** Runtime validation for an EvalCase (the admin route and the golden-file test use it). */
export const EvalCaseSchema = z.object({
  id: z.string().min(1).max(200),
  kind: z.enum(['retrieval', 'answer', 'refusal', 'injection']),
  question: z.string().trim().min(1).max(4000),
  history: z.array(Turn).max(24).optional(),
  expect: z.array(z.string().min(1)).max(20).optional(),
  mustInclude: z.array(z.string().min(1)).max(20).optional(),
  mustNotInclude: z.array(z.string().min(1)).max(40).optional(),
  mustNotMatch: z.array(z.string().min(1).max(300)).max(20).optional(),
  mustCite: z.boolean().optional(),
  k: z.number().int().min(1).max(50).optional(),
  notes: z.string().max(2000).optional(),
})

export interface EvalCheck {
  name: string
  passed: boolean
  detail?: string
}

export interface EvalCaseResult {
  id: string
  kind: EvalKind
  question: string
  retrieval: {
    /** Source ids in rank order (chunks of the same source collapsed). */
    retrieved: string[]
    /** Rank (1-based) of the first source matching each expected prefix, or null if missing. */
    ranks: (number | null)[]
    firstRelevantRank: number | null
    hit: { at1: boolean; at3: boolean; at8: boolean }
    reciprocalRank: number
  } | null
  answer: {
    text: string
    cited: number[]
    citedIds: string[]
    guarded: boolean
    provider: string
    model: string
    latencyMs: number
  } | null
  checks: EvalCheck[]
  passed: boolean
  latencyMs: number
  error?: string
}

export function scoreRetrieval(retrieved: string[], expect: string[]): NonNullable<EvalCaseResult['retrieval']> {
  const rankOf = (prefix: string): number | null => {
    const i = retrieved.findIndex((id) => id.startsWith(prefix))
    return i === -1 ? null : i + 1
  }
  const ranks = expect.map(rankOf)
  const found = ranks.filter((r): r is number => r !== null)
  const first = found.length ? Math.min(...found) : null
  return {
    retrieved,
    ranks,
    firstRelevantRank: first,
    hit: { at1: first !== null && first <= 1, at3: first !== null && first <= 3, at8: first !== null && first <= 8 },
    reciprocalRank: first ? 1 / first : 0,
  }
}

export function checkAnswer(c: EvalCase, text: string, cited: number[]): EvalCheck[] {
  const lower = text.toLowerCase()
  const checks: EvalCheck[] = []
  for (const entry of c.mustInclude ?? []) {
    const alts = entry.split('|').map((a) => a.trim().toLowerCase()).filter(Boolean)
    checks.push({ name: `includes ${entry}`, passed: alts.some((a) => lower.includes(a)) })
  }
  for (const s of c.mustNotInclude ?? []) {
    checks.push({ name: `excludes ${s}`, passed: !lower.includes(s.toLowerCase()) })
  }
  for (const pattern of c.mustNotMatch ?? []) {
    let passed = true
    let detail: string | undefined
    try {
      const m = text.match(new RegExp(pattern, 'i'))
      passed = !m
      if (m) detail = m[0]
    } catch {
      detail = 'invalid pattern'
    }
    checks.push({ name: `not /${pattern}/`, passed, detail })
  }
  if (c.mustCite) checks.push({ name: 'cites a source', passed: cited.length > 0 })
  return checks
}

export async function runEvalCase(env: AppEnv, c: EvalCase, opts: { rerank?: boolean } = {}): Promise<EvalCaseResult> {
  const started = Date.now()
  const messages: ChatTurn[] = [...(c.history ?? []), { role: 'user', content: c.question }]
  const result: EvalCaseResult = {
    id: c.id,
    kind: c.kind,
    question: c.question,
    retrieval: null,
    answer: null,
    checks: [],
    passed: false,
    latencyMs: 0,
  }
  try {
    if (c.expect?.length) {
      const chunks = await retrieveChunks(env, retrievalQuery(messages), { k: Math.max(8, c.k ?? 8), rerank: opts.rerank })
      const ids = [...new Set(chunks.map((ch) => ch.sourceId))]
      result.retrieval = scoreRetrieval(ids, c.expect)
    }
    if (c.kind !== 'retrieval') {
      // Eval histories come from the admin, so their assistant turns are signed as if the clone said them.
      const signed = await signTurns(turnSecret(env), messages)
      const a = await collectAnswer(env, { messages: signed, channel: 'studio', clientId: 'eval' }, { log: false, retrieve: { rerank: opts.rerank } })
      result.answer = {
        text: a.text,
        cited: a.cited,
        citedIds: a.cited.map((n) => a.sources.find((s) => s.n === n)?.id ?? String(n)),
        guarded: a.guarded,
        provider: a.provider,
        model: a.model,
        latencyMs: a.latencyMs,
      }
      result.checks = checkAnswer(c, a.text, a.cited)
      result.passed = result.checks.every((ch) => ch.passed)
    } else {
      const k = c.k ?? 8
      const rank = result.retrieval?.firstRelevantRank ?? null
      result.checks = [{ name: `relevant source in top ${k}`, passed: rank !== null && rank <= k }]
      result.passed = result.checks[0].passed
    }
  } catch (err) {
    result.error = err instanceof RagError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err)
    result.passed = false
  }
  result.latencyMs = Date.now() - started
  return result
}
