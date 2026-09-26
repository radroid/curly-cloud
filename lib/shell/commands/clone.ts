import { splitCitations } from '@/lib/client/sse'
import type { AnswerEvent, CitationSource, FitAssessment, FitDimension } from '@/lib/rag/types'
import { parseArgs } from '../args'
import { out, outln, usage, type CommandContext, type CommandDef } from '../command'
import { accent, cmd, dim, err, hi, route, seg, strong, url, writeln, type Printable } from '../output'
import type { Segment } from '../types'

/** The chat API accepts at most 12 turns. */
export const MAX_TURNS = 12

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

function sourceHref(s: CitationSource | undefined): string | null {
  return s && s.visibility === 'public' && s.anchor ? `/#${s.anchor}` : null
}

function citeSegment(n: number, sources: CitationSource[]): Segment {
  const href = sourceHref(sources.find((s) => s.n === n))
  return href ? route(href, `[${n}]`) : accent(`[${n}]`)
}

/** `[1] Resume · Eddy Solutions — Built the company's…`; snippets only exist for public sources. */
export function footnote(s: CitationSource, isTTY: boolean): Printable[] {
  const href = sourceHref(s)
  const title = href && isTTY ? route(href, s.title, 'plain') : seg(s.title, s.visibility === 'private' ? 'dim' : undefined)
  const parts: Printable[] = [accent(`[${s.n}] `), title]
  if (s.snippet) parts.push(dim(` — ${truncate(s.snippet, 110)}`))
  return parts
}

function cloneNotice(ctx: CommandContext): void {
  if (ctx.shell.flags.cloneNotice) return
  ctx.shell.flags.cloneNotice = true
  writeln(
    ctx.stderr,
    hi('▸ '),
    dim(
      "You're talking to an AI clone of Raj, not Raj himself. It answers in his voice from his resume and his own interview answers, cites its sources, and can be wrong. Questions are logged to improve it.",
    ),
  )
}

function unavailable(ctx: CommandContext, event: Extract<AnswerEvent, { type: 'error' }>): number {
  writeln(ctx.stderr, err(`ask: ${event.message}`))
  if (event.code === 'rate_limited' || event.code === 'budget_exceeded') {
    writeln(ctx.stderr, dim('Try again in a while. Meanwhile, the files have the facts: '), cmd('resume'), dim(' · '), cmd('grep -ri mcp ~'))
  } else if (event.code !== 'bad_request') {
    writeln(
      ctx.stderr,
      dim('Everything it knows from the resume is also in these files: '),
      cmd('cat about.txt'),
      dim(' · '),
      cmd('resume'),
      dim(' · '),
      cmd('grep -ri agent ~'),
    )
  }
  return 1
}

/** Ask one question, streaming the answer. Returns the exit code. */
async function askOnce(ctx: CommandContext, question: string): Promise<number> {
  const shell = ctx.shell
  const history = shell.conversation.slice(-(MAX_TURNS - 1))
  while (history.length && history[0].role !== 'user') history.shift()
  const messages = [...history, { role: 'user' as const, content: question }]

  let text = ''
  let sources: CitationSource[] = []
  let pending = ''
  let done: Extract<AnswerEvent, { type: 'done' }> | null = null
  let failure: Extract<AnswerEvent, { type: 'error' }> | null = null

  // Hold back a partial "[1" at the end of a chunk so markers never render half-styled.
  const emit = (chunk: string, final: boolean): void => {
    let t = pending + chunk
    pending = ''
    if (!final) {
      const m = /\[\d{0,2}$/.exec(t)
      if (m) {
        pending = m[0]
        t = t.slice(0, m.index)
      }
    }
    if (!t) return
    if (!ctx.isTTY) return out(ctx, t)
    ctx.stdout.write(splitCitations(t).map((p) => (p.type === 'text' ? seg(p.text) : citeSegment(p.n, sources))))
  }

  try {
    for await (const ev of shell.streamAnswer('/api/chat', { messages, channel: 'terminal' }, ctx.signal)) {
      if (ctx.signal.aborted) break
      if (ev.type === 'sources') sources = ev.sources ?? []
      else if (ev.type === 'delta') {
        text += ev.text
        emit(ev.text, false)
      } else if (ev.type === 'done') done = ev
      else if (ev.type === 'error') {
        failure = ev
        break
      }
    }
  } catch (e) {
    if (!ctx.signal.aborted && !isAbort(e)) failure = { type: 'error', code: 'unavailable', message: 'The clone is unavailable right now.' }
  }
  if (ctx.signal.aborted) {
    if (text) out(ctx, '\n')
    return 130
  }
  emit('', true)
  if (text && !text.endsWith('\n')) out(ctx, '\n')
  if (failure) return unavailable(ctx, failure)
  if (!text && !done) return unavailable(ctx, { type: 'error', code: 'unavailable', message: 'The clone sent an empty answer.' })

  const cited = done?.cited?.length
    ? done.cited
    : [...new Set(splitCitations(text).flatMap((p) => (p.type === 'cite' ? [p.n] : [])))]
  const list = cited.map((n) => sources.find((s) => s.n === n)).filter((s): s is CitationSource => !!s)
  if (list.length) {
    outln(ctx)
    for (const s of list) outln(ctx, footnote(s, ctx.isTTY))
  }
  if (done?.guarded) writeln(ctx.stderr, dim('(The answer stopped early: it was about to repeat a private source word for word.)'))

  // Remember the exchange for follow-ups. The answer goes back only with the server's signature
  // (unsigned assistant turns are dropped server-side); a refused or cut-short exchange is not
  // replayed, since the server checks every user turn it receives.
  if (!done?.guarded) {
    shell.conversation.push({ role: 'user', content: question })
    if (done?.sig) shell.conversation.push({ role: 'assistant', content: text, sig: done.sig })
    if (shell.conversation.length > MAX_TURNS) shell.conversation = shell.conversation.slice(-MAX_TURNS)
  }
  return 0
}

const ask: CommandDef = {
  name: 'ask',
  summary: "ask Raj's AI clone a question",
  kind: 'local',
  group: 'raj',
  operands: [{ kind: 'question', label: 'your question (quote it)' }],
  describe: (args) =>
    args.length
      ? `ask sends "${args.join(' ')}" to Raj's AI clone and streams its answer, with numbered citations.`
      : 'ask with no question opens a conversation with the clone at a raj> prompt; type exit to leave.',
  man: {
    synopsis: ['ask "QUESTION"', 'ask', 'echo QUESTION | ask'],
    description: [
      "Ask Raj's AI clone. It answers in the first person from his resume and his own interview answers, and marks claims with [n]; the sources are listed underneath. Public sources link to the matching line on the website.",
      'It is an AI: it can be wrong, and questions are logged so Raj can improve it. With no question you get a raj> prompt for a back-and-forth conversation; exit or Ctrl-D leaves it, Ctrl-C stops an answer.',
      'The answer is ordinary output, so pipes work: ask "…" | grep -i python.',
    ],
    examples: [
      ['ask "what are you building now?"', 'one question'],
      ['ask', 'a conversation'],
      ['ask "how do you evaluate RAG?" | grep -i recall', 'filter the answer'],
    ],
    seeAlso: ['fit', 'mcp', 'resume'],
  },
  async run(ctx) {
    const question = ctx.args.join(' ').trim() || (ctx.stdin?.trim() ?? '')
    if (question) {
      cloneNotice(ctx)
      return askOnce(ctx, question)
    }
    if (!ctx.readLine) return usage(ctx, 'what do you want to ask? e.g. ask "what are you building now?"')
    cloneNotice(ctx)
    writeln(ctx.stderr, dim('Talking to the clone. Type exit or press Ctrl-D to leave; Ctrl-C stops an answer.'))
    let status = 0
    while (true) {
      const q = await ctx.readLine([seg('raj', 'prompt'), dim('> ')], { signal: ctx.signal })
      if (q === null || ctx.signal.aborted) break
      const t = q.trim()
      if (!t) continue
      if (/^(exit|quit|bye|logout|q)$/i.test(t)) break
      status = await askOnce(ctx, t)
      if (status === 130) return 130
    }
    return ctx.signal.aborted ? 130 : status
  },
}

// ── fit ──────────────────────────────────────────────────────────────────────

function dots(score: number): string {
  const s = Math.max(0, Math.min(5, Math.round(score)))
  return '●'.repeat(s) + '○'.repeat(5 - s)
}

function verdictStyle(v: string): Segment['style'] {
  return v === 'strong' ? 'accent' : v === 'weak' ? 'prompt' : 'highlight'
}

function evidence(nums: number[] | undefined): Printable[] {
  return (nums ?? []).map((n) => accent(`[${n}]`))
}

function renderDimension(ctx: CommandContext, label: string, d: FitDimension): void {
  outln(ctx)
  outln(ctx, strong(label.padEnd(10)), hi(dots(d.score)), dim(`  ${d.score}/5`))
  outln(ctx, '  ', d.summary, ' ', evidence(d.evidence))
  for (const s of d.strengths ?? []) outln(ctx, accent('  + '), s)
  for (const g of d.gaps ?? []) outln(ctx, seg('  − ', 'prompt'), g)
}

export function renderFit(ctx: CommandContext, f: FitAssessment): void {
  outln(ctx, hi('Role fit'), dim(' · '), strong(f.roleTitle), f.company ? dim(` at ${f.company}`) : '')
  outln(ctx)
  outln(ctx, strong('Overall'.padEnd(10)), hi(dots(f.overall.score)), dim(`  ${f.overall.score}/5  `), seg(f.overall.verdict, verdictStyle(f.overall.verdict)))
  outln(ctx, '  ', f.overall.summary)
  renderDimension(ctx, 'Technical', f.technical)
  renderDimension(ctx, 'Culture', f.culture)
  if (f.questionsForRaj?.length) {
    outln(ctx)
    outln(ctx, strong('Raj would want to know'))
    for (const q of f.questionsForRaj) outln(ctx, accent('  • '), q)
  }
  if (f.unknowns?.length) {
    outln(ctx)
    outln(ctx, strong('No evidence either way'), dim(' (ask Raj directly)'))
    for (const u of f.unknowns) outln(ctx, accent('  • '), u)
  }
  if (f.sources?.length) {
    outln(ctx)
    outln(ctx, strong('Sources'))
    for (const s of f.sources) outln(ctx, '  ', footnote(s, ctx.isTTY))
  }
  outln(ctx)
  outln(ctx, dim("This is the AI clone's read, not Raj's own. To talk to him: "), cmd('contact'))
}

async function readJobDescription(ctx: CommandContext): Promise<string | null> {
  if (ctx.stdin !== null) return ctx.stdin
  if (!ctx.readLine) return null
  outln(
    ctx,
    dim('Paste the job description. Finish with a line containing only '),
    hi('EOF'),
    dim('. (That is how a heredoc works: fit "Title" <<EOF … EOF.)'),
  )
  const lines: string[] = []
  while (true) {
    const l = await ctx.readLine([dim('jd> ')], { signal: ctx.signal })
    if (l === null || ctx.signal.aborted) return ctx.signal.aborted ? null : lines.join('\n')
    if (l.trim() === 'EOF') break
    lines.push(l)
  }
  return lines.join('\n')
}

const fit: CommandDef = {
  name: 'fit',
  summary: 'check how Raj fits a role (AI assessment)',
  kind: 'local',
  group: 'raj',
  flags: { '--company': 'the company name (optional)' },
  valueFlags: ['--company'],
  operands: [{ kind: 'text', label: 'role title' }],
  describe: (args) => `fit asks the clone to score Raj against ${args.filter((a) => !a.startsWith('--'))[0] ?? 'a role'}, reading the job description from its input.`,
  man: {
    synopsis: ['fit', 'fit "ROLE TITLE" [--company NAME] < jd.txt', 'fit "ROLE TITLE" <<EOF'],
    description: [
      'Score how well Raj fits a role, technically and culturally, with strengths, gaps, open questions and sources. Run it bare and it asks for the title, then the job description, ended by a line that says EOF.',
      'The description can also come from a file (fit "Title" < /tmp/jd.txt) or a heredoc. The assessment is generated by the AI clone and can be wrong.',
    ],
    options: [['--company NAME', 'say which company']],
    examples: [
      ['fit', 'step by step'],
      ['fit "Senior AI Engineer" < /tmp/jd.txt', 'from a file you wrote to /tmp'],
    ],
    seeAlso: ['ask', 'mcp'],
  },
  async run(ctx) {
    const a = parseArgs(ctx.args, { longValue: ['company', 'title'] })
    if (a.error) return usage(ctx, a.error)
    let roleTitle = (a.values.get('title') ?? a.operands.join(' ')).trim()
    let company: string | null = a.values.get('company')?.trim() || null
    if (!roleTitle) {
      if (!ctx.readLine || ctx.stdin !== null) return usage(ctx, 'give a role title, e.g. fit "AI Engineer" < /tmp/jd.txt')
      const t = await ctx.readLine([hi('Role title: ')], { signal: ctx.signal })
      if (t === null || ctx.signal.aborted) return 130
      roleTitle = t.trim()
      if (!roleTitle) return usage(ctx, 'a role title is required')
      if (!company) {
        const c = await ctx.readLine([hi('Company '), dim('(optional, Enter to skip): ')], { signal: ctx.signal })
        if (c === null || ctx.signal.aborted) return 130
        company = c.trim() || null
      }
    }
    const jd = await readJobDescription(ctx)
    if (ctx.signal.aborted) return 130
    if (jd === null) return usage(ctx, 'give it a job description: fit "Title" < /tmp/jd.txt')
    if (jd.trim().length < 20) return usage(ctx, 'that job description is too short to assess')

    cloneNotice(ctx)
    writeln(ctx.stderr, dim(`Assessing fit for ${roleTitle}${company ? ` at ${company}` : ''}… (this can take a little while)`))
    const doFetch = ctx.shell.host.fetch ?? globalThis.fetch.bind(globalThis)
    let res: Response
    try {
      res = await doFetch('/api/fit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roleTitle, jobDescription: jd, company, channel: 'terminal' }),
        signal: ctx.signal,
      })
    } catch (e) {
      if (ctx.signal.aborted || isAbort(e)) return 130
      writeln(ctx.stderr, err('fit: the role-fit service is unavailable right now.'))
      return 1
    }
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    if (!res.ok) {
      const message = (data as { error?: { message?: string } } | null)?.error?.message
      writeln(ctx.stderr, err(`fit: ${message ?? 'the role-fit service is unavailable right now.'}`))
      if (res.status === 404 || res.status >= 500) writeln(ctx.stderr, dim('Meanwhile: '), cmd('resume'), dim(' · '), cmd('skills'))
      return 1
    }
    const assessment = ((data as { assessment?: FitAssessment })?.assessment ?? data) as FitAssessment | null
    if (!assessment || !assessment.overall || !assessment.technical || !assessment.culture) {
      writeln(ctx.stderr, err('fit: the service sent an answer this terminal does not understand.'))
      return 1
    }
    renderFit(ctx, assessment)
    return 0
  },
}

// ── mcp ──────────────────────────────────────────────────────────────────────

const mcp: CommandDef = {
  name: 'mcp',
  summary: "connect your AI agent to Raj's MCP server",
  kind: 'local',
  group: 'raj',
  describe: () => "mcp explains how an AI agent can connect to Raj's MCP server.",
  man: {
    synopsis: ['mcp'],
    description: [
      'The Model Context Protocol lets an AI agent (Claude, Cursor, your own) call tools on a server. Raj runs one at /mcp so a recruiter’s agent can ask the clone questions, assess fit and fetch his resume directly.',
    ],
    seeAlso: ['ask', 'fit'],
  },
  run(ctx) {
    const origin = (ctx.shell.host.origin ?? 'https://curlycloud.dev').replace(/\/$/, '')
    const endpoint = `${origin}/mcp`
    const w = 10
    outln(ctx, strong("Raj's MCP server"), dim(': let your agent talk to the clone.'))
    outln(ctx)
    outln(ctx, dim('Endpoint'.padEnd(w)), url(endpoint, endpoint), dim('  (Streamable HTTP)'))
    outln(ctx, dim('Tools'.padEnd(w)), 'ask_raj, assess_fit, get_profile, get_resume, list_topics')
    outln(ctx, dim('Resource'.padEnd(w)), 'resume://raj-dholakia/ai-engineer')
    outln(ctx, dim('Prompt'.padEnd(w)), 'evaluate_candidate')
    outln(ctx, dim('For agents'.padEnd(w)), url(`${origin}/llms.txt`, `${origin}/llms.txt`))
    outln(ctx)
    outln(ctx, hi('Claude Code'))
    outln(ctx, `  claude mcp add --transport http raj ${endpoint}`)
    outln(ctx, hi('Claude Desktop, Cursor and other clients'), dim(' (mcp.json)'))
    outln(ctx, `  { "mcpServers": { "raj": { "url": "${endpoint}" } } }`)
    outln(ctx)
    outln(ctx, dim('Anonymous use is rate-limited. For more, ask Raj for a key and send it as '), 'Authorization: Bearer rc_…')
    outln(ctx, dim('Answers are AI-generated from his own words and cite their sources.'))
    return 0
  },
}

export const CLONE_COMMANDS: CommandDef[] = [ask, fit, mcp]
