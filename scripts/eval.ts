/**
 * Run the clone's evals against a running server.
 *
 *   bun run clone:eval [--url http://localhost:3201] [--only retrieval|answer|refusal|injection]
 *                      [--id <substring>] [--limit <n>] [--concurrency <n>] [--no-rerank] [--no-private]
 *
 * Cases come from evals/golden.json plus any private/evals/*.json with a `cases` array.
 * Config works like the clone CLI: ADMIN_TOKEN (and, for production, the Cloudflare Access service
 * token CF_ACCESS_CLIENT_ID/SECRET) come from the environment or .dev.vars. The URL defaults to
 * CLONE_URL, else http://localhost:3000. A JSON report (answers may quote private text) is written to
 * private/evals/<timestamp>.json, which is gitignored.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EvalCase, EvalCaseResult } from '@/lib/rag/eval'
import { api, type CliConfig, loadConfig } from '@/scripts/clone'

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
const KINDS = ['retrieval', 'answer', 'refusal', 'injection'] as const

interface Args {
  url: string
  only: string | null
  id: string | null
  limit: number
  concurrency: number
  rerank: boolean
  includePrivate: boolean
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag)
    return i === -1 ? null : (argv[i + 1] ?? null)
  }
  const only = get('--only')
  if (only && !KINDS.includes(only as (typeof KINDS)[number])) {
    console.error(`--only must be one of ${KINDS.join(', ')}`)
    process.exit(2)
  }
  return {
    url: (get('--url') ?? process.env.CLONE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    only,
    id: get('--id'),
    limit: Number(get('--limit') ?? Infinity),
    concurrency: Math.max(1, Number(get('--concurrency') ?? 2)),
    rerank: !argv.includes('--no-rerank'),
    includePrivate: !argv.includes('--no-private'),
  }
}

function loadCases(includePrivate: boolean): { cases: EvalCase[]; files: string[] } {
  const files = [join(ROOT, 'evals/golden.json')]
  const privateDir = join(ROOT, 'private/evals')
  if (includePrivate && existsSync(privateDir)) {
    for (const f of readdirSync(privateDir).filter((f) => f.endsWith('.json')).sort()) files.push(join(privateDir, f))
  }
  const cases: EvalCase[] = []
  const used: string[] = []
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as { cases?: EvalCase[] }
    // Reports written by this script live in the same folder; they have no `cases`.
    if (!Array.isArray(data.cases)) continue
    cases.push(...data.cases)
    used.push(file.replace(`${ROOT}/`, ''))
  }
  return { cases, files: used }
}

async function runCase(args: Args, cfg: CliConfig, c: EvalCase): Promise<EvalCaseResult> {
  const started = Date.now()
  try {
    return await api<EvalCaseResult>(cfg, 'POST', `/api/admin/eval/case${args.rerank ? '' : '?rerank=0'}`, c, { timeoutMs: 120_000 })
  } catch (err) {
    return {
      id: c.id,
      kind: c.kind,
      question: c.question,
      retrieval: null,
      answer: null,
      checks: [],
      passed: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

const pct = (n: number, d: number): string => (d ? `${((100 * n) / d).toFixed(1)}%` : '—')

function summarize(results: EvalCaseResult[]) {
  const scored = results.filter((r) => r.retrieval)
  const retrieval = {
    n: scored.length,
    hitAt1: scored.filter((r) => r.retrieval!.hit.at1).length / (scored.length || 1),
    hitAt3: scored.filter((r) => r.retrieval!.hit.at3).length / (scored.length || 1),
    hitAt8: scored.filter((r) => r.retrieval!.hit.at8).length / (scored.length || 1),
    mrr: scored.reduce((s, r) => s + r.retrieval!.reciprocalRank, 0) / (scored.length || 1),
  }
  const rate = (kinds: string[]) => {
    const rs = results.filter((r) => kinds.includes(r.kind))
    return { n: rs.length, passed: rs.filter((r) => r.passed).length }
  }
  const latencies = results.filter((r) => r.answer).map((r) => r.answer!.latencyMs)
  return {
    retrieval,
    answers: rate(['answer']),
    refusals: rate(['refusal']),
    injections: rate(['injection']),
    errors: results.filter((r) => r.error).length,
    guarded: results.filter((r) => r.answer?.guarded).length,
    medianAnswerLatencyMs: latencies.length ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] : null,
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  let cfg: CliConfig
  try {
    cfg = loadConfig({ ...process.env, CLONE_URL: args.url })
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(2)
  }
  if (!cfg.token) {
    console.error('ADMIN_TOKEN is not set (env or .dev.vars).')
    process.exit(2)
  }
  const { cases: all, files } = loadCases(args.includePrivate)
  const cases = all
    .filter((c) => !args.only || c.kind === args.only)
    .filter((c) => !args.id || c.id.includes(args.id))
    .slice(0, args.limit)
  console.log(`Running ${cases.length} case(s) from ${files.join(', ')} against ${args.url}${args.rerank ? '' : ' (rerank off)'}\n`)

  const started = Date.now()
  const results = await pool(cases, args.concurrency, async (c) => {
    const r = await runCase(args, cfg, c)
    const rank = r.retrieval ? `rank ${r.retrieval.firstRelevantRank ?? '—'}` : ''
    const failed = r.checks.filter((ch) => !ch.passed).map((ch) => ch.name + (ch.detail ? ` (${ch.detail})` : ''))
    const note = r.error ? `ERROR ${r.error}` : failed.length ? `failed: ${failed.join('; ')}` : ''
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${c.kind.padEnd(9)} ${c.id.padEnd(22)} ${rank.padEnd(8)} ${String(r.latencyMs).padStart(6)}ms  ${note}`)
    return r
  })

  const s = summarize(results)
  console.log('\n┌─────────────────────────┬──────────┐')
  const row = (k: string, v: string) => console.log(`│ ${k.padEnd(23)} │ ${v.padStart(8)} │`)
  row(`retrieval cases`, String(s.retrieval.n))
  row('hit@1', pct(s.retrieval.hitAt1, 1))
  row('hit@3', pct(s.retrieval.hitAt3, 1))
  row('hit@8', pct(s.retrieval.hitAt8, 1))
  row('MRR', s.retrieval.mrr.toFixed(3))
  row(`answer pass (${s.answers.n})`, pct(s.answers.passed, s.answers.n))
  row(`refusal pass (${s.refusals.n})`, pct(s.refusals.passed, s.refusals.n))
  row(`injection pass (${s.injections.n})`, pct(s.injections.passed, s.injections.n))
  row('guarded answers', String(s.guarded))
  row('errors', String(s.errors))
  row('median answer latency', s.medianAnswerLatencyMs === null ? '—' : `${s.medianAnswerLatencyMs}ms`)
  console.log('└─────────────────────────┴──────────┘')

  const dir = join(ROOT, 'private/evals')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = join(dir, `${stamp}.json`)
  writeFileSync(
    file,
    JSON.stringify({ kind: 'raj-clone-eval-report', url: args.url, rerank: args.rerank, files, durationMs: Date.now() - started, summary: s, results }, null, 2),
  )
  console.log(`\nReport: ${file.replace(`${ROOT}/`, '')}`)
  if (s.errors === results.length && results.length > 0) process.exit(1)
}

await main()
