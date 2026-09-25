/**
 * The clone's command line, for Raj and for agents.
 *
 *   bun scripts/clone.ts <command> [args]      (or: bun run clone <command>)
 *
 * Talks to the admin API of a running server: CLONE_URL (default http://localhost:3000, Raj's dev
 * server) with ADMIN_TOKEN, both read from the environment or .dev.vars. Run `help` for commands.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ANSWERS_FORMAT, BACKUP_FORMAT, PACK_FORMAT, parseExport, parsePack } from '@/lib/interview'
import type { Answer, IngestResult, SourceInput } from '@/lib/rag/types'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DEFAULT_URL = 'http://localhost:3000'
const INGEST_BATCH = 500

export class CliError extends Error {}

// ── Config ────────────────────────────────────────────────────────────────────

/** Parse a .dev.vars / .env style file: KEY=value, optional quotes, # comments. */
export function parseDevVars(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    out[m[1]] = value
  }
  return out
}

export interface CliConfig {
  url: string
  token: string | null
  /** Where the token came from, for error messages. Never the token itself. */
  tokenSource: 'env' | '.dev.vars' | 'missing'
  local: boolean
}

export function loadConfig(env: Record<string, string | undefined> = process.env, root: string = ROOT): CliConfig {
  const file = join(root, '.dev.vars')
  const vars = existsSync(file) ? parseDevVars(readFileSync(file, 'utf8')) : {}
  const url = (env.CLONE_URL || vars.CLONE_URL || DEFAULT_URL).replace(/\/+$/, '')
  const token = env.ADMIN_TOKEN || vars.ADMIN_TOKEN || null
  const tokenSource = env.ADMIN_TOKEN ? 'env' : vars.ADMIN_TOKEN ? '.dev.vars' : 'missing'
  let local = false
  try {
    const host = new URL(url).hostname
    local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    throw new CliError(`CLONE_URL "${url}" is not a valid URL.`)
  }
  return { url, token, tokenSource, local }
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

type Fetch = typeof fetch

interface ApiError {
  error?: { code?: string; message?: string; issues?: string[] }
}

export async function api<T>(
  cfg: CliConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  opts: { fetchImpl?: Fetch; timeoutMs?: number } = {},
): Promise<T> {
  if (!cfg.token) throw new CliError('No ADMIN_TOKEN. Put it in .dev.vars (same value the server uses) or export ADMIN_TOKEN=…')
  const doFetch = opts.fetchImpl ?? fetch
  let res: Response
  try {
    res = await doFetch(`${cfg.url}${path}`, {
      method,
      headers: { authorization: `Bearer ${cfg.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'TimeoutError' || name === 'AbortError') throw new CliError(`${method} ${path} timed out after ${Math.round((opts.timeoutMs ?? 180_000) / 1000)}s.`)
    throw new CliError(
      `Can't reach ${cfg.url}. Start the dev server (bun run dev) or set CLONE_URL to a running server (e.g. CLONE_URL=http://localhost:3205).`,
    )
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* not JSON */
  }
  if (res.status === 401) {
    throw new CliError(`The server rejected the admin token (401). Check that ADMIN_TOKEN (from ${cfg.tokenSource}) matches the server's ADMIN_TOKEN.`)
  }
  if (res.status === 404) throw new CliError(`${method} ${path} doesn't exist on ${cfg.url} (404). That route may not be merged into this branch yet.`)
  if (!res.ok) {
    const e = (json as ApiError | null)?.error
    const issues = e?.issues?.length ? `\n${e.issues.map((i) => `  - ${i}`).join('\n')}` : ''
    const detail = e?.message ?? (text.trim().startsWith('<') ? 'the server returned an HTML error page (check the dev server logs)' : text.slice(0, 300))
    throw new CliError(`${method} ${path} failed with ${res.status}${e?.code ? ` ${e.code}` : ''}: ${detail}${issues}`)
  }
  if (json === null) throw new CliError(`${method} ${path} returned something that isn't JSON. Is ${cfg.url} this app?`)
  return json as T
}

// ── Files ─────────────────────────────────────────────────────────────────────

export type FileKind = 'answers' | 'sources' | 'pack' | 'backup' | 'unknown'

export function detectFormat(json: unknown): FileKind {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return 'unknown'
  const format = (json as { format?: unknown }).format
  if (format === ANSWERS_FORMAT) return 'answers'
  if (format === PACK_FORMAT) return 'pack'
  if (format === BACKUP_FORMAT) return 'backup'
  if (Array.isArray((json as { sources?: unknown }).sources)) return 'sources'
  return 'unknown'
}

/** Expand args to JSON files: files as given, directories to their *.json files (not recursive). */
export function collectFiles(args: string[], cwd: string = process.cwd()): string[] {
  const out: string[] = []
  for (const arg of args) {
    const p = resolve(cwd, arg)
    if (!existsSync(p)) throw new CliError(`No such file or folder: ${arg}`)
    if (statSync(p).isDirectory()) {
      const files = readdirSync(p)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => join(p, f))
      if (!files.length) throw new CliError(`${arg} has no .json files.`)
      out.push(...files)
    } else out.push(p)
  }
  return out
}

function readJson(file: string): { text: string; json: unknown } {
  const text = readFileSync(file, 'utf8')
  try {
    return { text, json: JSON.parse(text) }
  } catch (err) {
    throw new CliError(`${basename(file)} is not valid JSON (${err instanceof Error ? err.message : String(err)}).`)
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

type Log = (line: string) => void

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function describeResult(r: IngestResult): string {
  const parts = [`${r.upserted} new or changed`, `${r.unchanged} unchanged`]
  if (r.deleted) parts.push(`${r.deleted} deleted`)
  parts.push(plural(r.chunks, 'chunk'), `${r.embedded} embedded`, `corpus v${r.corpusVersion}`)
  return parts.join(', ')
}

function logErrors(log: Log, errors: { id: string; message: string }[]): void {
  for (const e of errors.slice(0, 20)) log(`    ! ${e.id}: ${e.message}`)
  if (errors.length > 20) log(`    … and ${errors.length - 20} more`)
}

function guardProduction(cfg: CliConfig, flags: Set<string>, action: string): void {
  if (cfg.local || flags.has('--yes')) return
  throw new CliError(
    `${action} would write to ${cfg.url}, which isn't a local server. Only do this with Raj's explicit go-ahead, then re-run with --yes.`,
  )
}

// ── Commands ──────────────────────────────────────────────────────────────────

interface Ctx {
  cfg: CliConfig
  log: Log
  fetchImpl?: Fetch
  flags: Set<string>
}

async function cmdSeed(ctx: Ctx): Promise<number> {
  guardProduction(ctx.cfg, ctx.flags, 'Seeding')
  ctx.log(`Seeding the public resume into ${ctx.cfg.url} …`)
  const r = await api<IngestResult>(ctx.cfg, 'POST', '/api/admin/seed', undefined, { fetchImpl: ctx.fetchImpl })
  ctx.log(`✓ Resume seeded: ${describeResult(r)}`)
  logErrors(ctx.log, r.errors)
  return r.errors.length ? 1 : 0
}

async function ingestAnswers(ctx: Ctx, file: string, text: string, json: unknown): Promise<boolean> {
  const name = basename(file)
  const parsed = parseExport(json)
  if (!parsed.ok) {
    ctx.log(`✗ ${name}: not a valid answers export`)
    for (const e of parsed.errors) ctx.log(`    - ${e}`)
    return false
  }
  const res = await api<{ result: IngestResult; answers: number; skipped?: number }>(ctx.cfg, 'POST', '/api/admin/import', text, {
    fetchImpl: ctx.fetchImpl,
  })
  const skipped = res.skipped ? `, ${res.skipped} empty skipped` : ''
  ctx.log(`✓ ${name}: ${plural(res.answers, 'answer')} imported${skipped}. ${describeResult(res.result)}`)
  logErrors(ctx.log, res.result.errors)
  return res.result.errors.length === 0
}

async function ingestSourcesFile(ctx: Ctx, file: string, json: { sources: SourceInput[]; replaceKind?: string }): Promise<boolean> {
  const name = basename(file)
  let ok = true
  for (let i = 0; i < json.sources.length; i += INGEST_BATCH) {
    const batch = json.sources.slice(i, i + INGEST_BATCH)
    const body: Record<string, unknown> = { sources: batch }
    if (json.replaceKind) {
      if (json.sources.length > INGEST_BATCH) throw new CliError(`${name}: replaceKind only works with ${INGEST_BATCH} sources or fewer per file.`)
      body.replaceKind = json.replaceKind
    }
    const r = await api<IngestResult>(ctx.cfg, 'POST', '/api/admin/ingest', body, { fetchImpl: ctx.fetchImpl })
    ctx.log(`✓ ${name}${json.sources.length > INGEST_BATCH ? ` [${i + 1}–${i + batch.length}]` : ''}: ${plural(batch.length, 'source')}. ${describeResult(r)}`)
    logErrors(ctx.log, r.errors)
    if (r.errors.length) ok = false
  }
  return ok
}

async function cmdIngest(ctx: Ctx, args: string[]): Promise<number> {
  if (!args.length) throw new CliError('Usage: bun scripts/clone.ts ingest <file.json|folder> [more…]')
  guardProduction(ctx.cfg, ctx.flags, 'Ingesting')
  const files = collectFiles(args)
  ctx.log(`Ingesting ${plural(files.length, 'file')} into ${ctx.cfg.url} …`)
  let failed = 0
  for (const file of files) {
    const name = basename(file)
    try {
      const { text, json } = readJson(file)
      const kind = detectFormat(json)
      let ok = true
      if (kind === 'answers') ok = await ingestAnswers(ctx, file, text, json)
      else if (kind === 'sources') ok = await ingestSourcesFile(ctx, file, json as { sources: SourceInput[]; replaceKind?: string })
      else if (kind === 'pack') ctx.log(`- ${name}: a question pack, not answers. Import it in interview/raj-interview.html (File › Import question pack).`)
      else if (kind === 'backup') ctx.log(`- ${name}: a full stack backup. Export answers from the HTML (File › Export answers) and ingest that instead.`)
      else {
        ctx.log(`✗ ${name}: unknown format. Expected a "${ANSWERS_FORMAT}" export or { "sources": [...] }.`)
        ok = false
      }
      if (!ok) failed++
    } catch (err) {
      if (!(err instanceof CliError)) throw err
      ctx.log(`✗ ${name}: ${err.message}`)
      failed++
      // A dead server or bad token fails every file the same way; stop early.
      if (/Can't reach|rejected the admin token/.test(err.message)) break
    }
  }
  if (failed) ctx.log(`${plural(failed, 'file')} failed.`)
  return failed ? 1 : 0
}

async function cmdPersona(ctx: Ctx): Promise<number> {
  guardProduction(ctx.cfg, ctx.flags, 'Rebuilding the persona')
  ctx.log(`Rebuilding the persona on ${ctx.cfg.url} (this reads every private answer, give it a minute) …`)
  const r = await api<{ text: string; sourcesUsed: number }>(ctx.cfg, 'POST', '/api/admin/persona', undefined, { fetchImpl: ctx.fetchImpl })
  ctx.log(`✓ Persona rebuilt from ${plural(r.sourcesUsed, 'source')}:\n`)
  ctx.log(r.text.trim())
  return 0
}

async function cmdAsk(ctx: Ctx, args: string[]): Promise<number> {
  const question = args.join(' ').trim()
  if (!question) throw new CliError('Usage: bun scripts/clone.ts ask "What do you look for in a team?"')
  const a = await api<Answer>(ctx.cfg, 'POST', '/api/admin/debug/answer', { question }, { fetchImpl: ctx.fetchImpl })
  ctx.log(`Q: ${question}\n`)
  ctx.log(a.text.trim())
  const cited = new Set(a.cited)
  const used = a.sources.filter((s) => cited.has(s.n))
  ctx.log(`\nCited (${used.length} of ${a.sources.length} retrieved):`)
  for (const s of used) ctx.log(`  [${s.n}] ${s.title}  (${s.kind}, ${s.visibility}${s.topic ? `, ${s.topic}` : ''})`)
  if (!used.length) ctx.log('  none')
  ctx.log(`\n${a.provider} · ${a.model} · ${a.latencyMs} ms${a.guarded ? ' · cut short by the verbatim guard' : ''}`)
  return 0
}

async function cmdStats(ctx: Ctx): Promise<number> {
  const s = await api<Record<string, unknown>>(ctx.cfg, 'GET', '/api/admin/stats', undefined, { fetchImpl: ctx.fetchImpl })
  ctx.log(`Stats for ${ctx.cfg.url}\n`)
  ctx.log(JSON.stringify(s, null, 2))
  return 0
}

/** Local only: validate answers exports and question packs without a server. */
function cmdValidate(ctx: Ctx, args: string[]): number {
  if (!args.length) throw new CliError('Usage: bun scripts/clone.ts validate <file.json|folder> [more…]')
  let failed = 0
  for (const file of collectFiles(args)) {
    const name = basename(file)
    try {
      const { json } = readJson(file)
      const kind = detectFormat(json)
      if (kind === 'answers') {
        const r = parseExport(json)
        if (!r.ok) {
          failed++
          ctx.log(`✗ ${name}: answers export with problems`)
          for (const e of r.errors) ctx.log(`    - ${e}`)
          continue
        }
        const byTopic: Record<string, number> = {}
        let words = 0
        for (const a of r.data.answers) {
          byTopic[a.topic] = (byTopic[a.topic] ?? 0) + 1
          words += a.wordCount
        }
        const topics = Object.entries(byTopic)
          .map(([t, n]) => `${t} ${n}`)
          .join(', ')
        ctx.log(`✓ ${name}: ${plural(r.data.answers.length, 'answer')} (${words} words; scope ${r.data.scope}; bank ${r.data.bankVersion}). ${topics}`)
      } else if (kind === 'pack') {
        const r = parsePack(json)
        if (!r.ok) {
          failed++
          ctx.log(`✗ ${name}: question pack with problems`)
          for (const e of r.errors) ctx.log(`    - ${e}`)
          continue
        }
        ctx.log(`✓ ${name}: question pack "${r.data.title}" with ${plural(r.data.questions.length, 'question')} (${r.data.packId}).`)
      } else {
        failed++
        ctx.log(`✗ ${name}: not an answers export or question pack (detected: ${kind}).`)
      }
    } catch (err) {
      if (!(err instanceof CliError)) throw err
      failed++
      ctx.log(`✗ ${name}: ${err.message}`)
    }
  }
  return failed ? 1 : 0
}

export const HELP = `Raj's clone CLI

  bun scripts/clone.ts <command> [args]        (or: bun run clone <command>)

Commands
  seed                     Load the public resume into the knowledge base      POST /api/admin/seed
  ingest <file|folder>…    Ingest interview exports (raj-clone-answers-*.json)  POST /api/admin/import
                           or { "sources": [...] } files                       POST /api/admin/ingest
                           A folder ingests every .json file in it.
  persona                  Rebuild the distilled persona and print it          POST /api/admin/persona
  ask "<question>"         Ask the clone (studio channel) and show citations   POST /api/admin/debug/answer
  stats                    Corpus and usage stats                              GET  /api/admin/stats
  validate <file|folder>…  Check exports and question packs locally (no server)
  help                     This message

Config (environment, else .dev.vars)
  CLONE_URL    default ${DEFAULT_URL} (Raj's dev server). Use another port for isolated servers.
  ADMIN_TOKEN  must match the server's ADMIN_TOKEN.

Writes to a non-local CLONE_URL (production) need --yes, and only with Raj's explicit go-ahead.
`

export async function run(argv: string[], deps: { log?: Log; env?: Record<string, string | undefined>; fetchImpl?: Fetch } = {}): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line))
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const [cmd, ...rest] = argv.filter((a) => !a.startsWith('--'))
  if (!cmd || cmd === 'help' || flags.has('--help')) {
    log(HELP)
    return 0
  }
  try {
    if (cmd === 'validate') return cmdValidate({ cfg: loadConfig(deps.env ?? process.env), log, flags }, rest)
    const cfg = loadConfig(deps.env ?? process.env)
    const ctx: Ctx = { cfg, log, fetchImpl: deps.fetchImpl, flags }
    switch (cmd) {
      case 'seed':
        return await cmdSeed(ctx)
      case 'ingest':
        return await cmdIngest(ctx, rest)
      case 'persona':
        return await cmdPersona(ctx)
      case 'ask':
        return await cmdAsk(ctx, rest)
      case 'stats':
        return await cmdStats(ctx)
      default:
        log(`Unknown command "${cmd}".\n`)
        log(HELP)
        return 2
    }
  } catch (err) {
    if (err instanceof CliError) {
      log(`✗ ${err.message}`)
      return 1
    }
    throw err
  }
}

if (import.meta.main) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}
