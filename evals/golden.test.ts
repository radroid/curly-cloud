import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resumeSources } from '@/content/resume'
import { EvalCaseSchema } from '@/lib/rag/eval'

const golden = JSON.parse(readFileSync(join(process.cwd(), 'evals/golden.json'), 'utf8')) as { version: number; cases: unknown[] }
const ids = resumeSources().map((s) => s.id)

describe('evals/golden.json', () => {
  it('has valid, uniquely named cases covering every kind', () => {
    const cases = golden.cases.map((c) => EvalCaseSchema.parse(c))
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length)
    for (const kind of ['retrieval', 'answer', 'refusal', 'injection'] as const) {
      expect(cases.filter((c) => c.kind === kind).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('only expects source ids that exist in the public corpus, and every regex compiles', () => {
    for (const raw of golden.cases) {
      const c = EvalCaseSchema.parse(raw)
      for (const prefix of c.expect ?? []) expect(ids.some((id) => id.startsWith(prefix)), `${c.id}: ${prefix}`).toBe(true)
      for (const pattern of c.mustNotMatch ?? []) expect(() => new RegExp(pattern, 'i')).not.toThrow()
      if (c.kind === 'retrieval') expect(c.expect?.length, c.id).toBeGreaterThan(0)
    }
  })
})
