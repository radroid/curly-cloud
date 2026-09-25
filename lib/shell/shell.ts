/**
 * rsh: the terminal's shell. Owns state (variables, aliases, history, cwd, the filesystem) and
 * executes parsed command lines: lists, &&/||, pipelines, subshells, redirects, heredocs.
 */
import { streamAnswer as defaultStreamAnswer } from '@/lib/client/sse'
import type { ChatTurn } from '@/lib/rag/types'
import { suggest } from './args'
import { COMMANDS } from './commands'
import type { CommandContext, CommandDef } from './command'
import { completeLine } from './complete'
import { ExpansionError, expandVarsInText, expandWord, expandWords, type ExpandContext } from './expand'
import { buildBaseTree, HOME, HOSTNAME, type BinEntry } from './fs-content'
import { expandGlob } from './glob'
import { checkLearn, emptyLearn, sanitizeLearn, type LearnState } from './learn'
import { ShellSyntaxError } from './lexer'
import { BufferSink, cmd, dim, err, pad, seg, strong, TeeSink, writeln } from './output'
import { parse, type AndOr, type Command, type List, type Pipeline, type Redirect, type RedirectOp, type SimpleCommand } from './parser'
import { DEFAULT_PS1, renderPrompt } from './prompt'
import type { Completion, Line, ReadLine, Segment, ShellHost, ShellIO, Sink } from './types'
import { canWrite, dirname, FsError, modeString, normalizePath, resolvePath, tildify, VFS, type OverlayEntry } from './vfs'

export interface TraceEntry {
  name: string
  args: string[]
  status: number
  /** Names assigned by `NAME=value` words on this command. */
  assigns: string[]
  redirects: { op: RedirectOp; fd: number; path: string }[]
}

/** Internal I/O for one command. */
export interface ExecIO {
  stdin: string | null
  stdout: Sink
  stderr: Sink
  isTTY: boolean
  signal: AbortSignal
  readLine: ReadLine | null
}

interface VarEntry {
  /** null: declared (e.g. `export FOO`) but not set. */
  value: string | null
  exported: boolean
}

interface SavedState {
  v: 1
  history: string[]
  historyOffset: number
  env: Record<string, string | null>
  aliases: Record<string, string | null>
  files: Record<string, OverlayEntry>
  learn: LearnState
}

const HISTORY_LIMIT = 500
const VOLATILE_ENV = new Set(['PWD', 'OLDPWD'])
const DISCARD: Sink = { write: () => {} }

export const WELCOME_SUGGESTIONS: [string, string][] = [
  ['help', 'every command, grouped'],
  ['learn', 'a hands-on tutorial in 7 short lessons'],
  ['cat about.txt', 'who Raj is'],
  ['ask "what are you building now?"', 'talk to his AI clone'],
  ['open macintosh', 'the 1984 Mac version of this site'],
]

function isAbort(e: unknown): boolean {
  return e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')
}

/** Quote an argument for display only if needed. */
export function quoteArg(arg: string): string {
  if (arg === '') return "''"
  if (/^[A-Za-z0-9_@%+=:,./~-]+$/.test(arg)) return arg
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

export class Shell {
  readonly host: ShellHost
  readonly vfs: VFS
  readonly aliases = new Map<string, string>()
  /** Resolves once ~/.profile has been sourced and saved state restored. */
  readonly ready: Promise<void>
  /** The session's conversation with the clone (not persisted). */
  conversation: ChatTurn[] = []
  learn: LearnState = emptyLearn()
  lastStatus = 0
  /** One-time notices per session. */
  readonly flags = { cloneNotice: false, permissionHint: false, background: false }
  /** Simple commands run by the current submit, for `learn` checks. */
  trace: TraceEntry[] = []
  subshellDepth = 0

  private vars = new Map<string, VarEntry>()
  private _history: string[] = []
  private _historyOffset = 0
  private _cwd = HOME
  private booted = false
  private baseline: { env: Record<string, string>; aliases: Record<string, string> } = { env: {}, aliases: {} }
  private readonly registry: Map<string, CommandDef>
  private lastSubstStatus: number | null = null
  private restored = { history: 0, files: 0 }

  constructor(host: ShellHost = {}) {
    this.host = host
    this.registry = new Map(COMMANDS.map((c) => [c.name, c]))
    const bins: BinEntry[] = COMMANDS.filter((c) => c.kind !== 'builtin').map((c) => ({
      name: c.name,
      dir: c.kind === 'local' ? '/usr/local/bin' : '/bin',
      summary: c.summary,
    }))
    this.vfs = new VFS(buildBaseTree(bins), () => this.now().getTime())
    this.loginVars()
    const saved = this.loadSaved()
    if (saved) {
      this._history = saved.history.slice(-HISTORY_LIMIT)
      this._historyOffset = saved.historyOffset
      this.vfs.load(saved.files)
      this.learn = sanitizeLearn(saved.learn)
      this.restored = { history: this._history.length, files: Object.keys(this.vfs.serialize()).length }
    }
    this.ready = this.boot(saved)
  }

  // ── Environment ────────────────────────────────────────────────────────────

  private loginVars(): void {
    const exported: [string, string][] = [
      ['USER', 'guest'],
      ['HOME', HOME],
      ['PWD', HOME],
      ['OLDPWD', HOME],
      ['SHELL', '/bin/rsh'],
      ['PATH', '/bin'],
      ['TERM', 'xterm-256color'],
    ]
    for (const [k, v] of exported) this.vars.set(k, { value: v, exported: true })
    this.vars.set('HOSTNAME', { value: HOSTNAME, exported: false })
    this.vars.set('HISTSIZE', { value: String(HISTORY_LIMIT), exported: false })
    this._cwd = HOME
  }

  private async boot(saved: SavedState | null): Promise<void> {
    const io = this.silentIO()
    await this.sourceFile(`${HOME}/.profile`, io)
    this.baseline = { env: this.exportedVars(), aliases: Object.fromEntries(this.aliases) }
    if (saved) {
      for (const [k, v] of Object.entries(saved.env ?? {})) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || VOLATILE_ENV.has(k)) continue
        if (v === null) this.unsetVar(k)
        else this.exportVar(k, String(v))
      }
      for (const [k, v] of Object.entries(saved.aliases ?? {})) {
        if (v === null) this.aliases.delete(k)
        else this.aliases.set(k, String(v))
      }
    }
    this.lastStatus = 0
    this.booted = true
  }

  private silentIO(): ExecIO {
    return { stdin: null, stdout: DISCARD, stderr: DISCARD, isTTY: false, signal: new AbortController().signal, readLine: null }
  }

  getVar(name: string): string | undefined {
    switch (name) {
      case '?':
        return String(this.lastStatus)
      case '$':
        return '1984'
      case '#':
        return '0'
      case '0':
        return 'rsh'
      case '@':
      case '*':
        return ''
      case 'RANDOM':
        return String(Math.floor(this.random() * 32768))
    }
    if (/^[1-9!-]$/.test(name)) return undefined
    const v = this.vars.get(name)
    return v?.value ?? undefined
  }

  hasVar(name: string): boolean {
    return this.vars.get(name)?.value != null
  }

  isExported(name: string): boolean {
    return this.vars.get(name)?.exported ?? false
  }

  setVar(name: string, value: string): void {
    const existing = this.vars.get(name)
    this.vars.set(name, { value, exported: existing?.exported ?? false })
  }

  exportVar(name: string, value?: string): void {
    const existing = this.vars.get(name)
    this.vars.set(name, { value: value ?? existing?.value ?? null, exported: true })
  }

  unsetVar(name: string): void {
    this.vars.delete(name)
  }

  /** Exported variables with values: what `env` prints and programs inherit. */
  exportedVars(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of this.vars) if (v.exported && v.value !== null) out[k] = v.value
    return out
  }

  /** Every variable with a value: what `set` prints. */
  allVars(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of this.vars) if (v.value !== null) out[k] = v.value
    return out
  }

  // ── Filesystem helpers ─────────────────────────────────────────────────────

  get cwd(): string {
    return this._cwd
  }

  get home(): string {
    return this.getVar('HOME') || HOME
  }

  resolve(path: string): string {
    return resolvePath(this._cwd, path)
  }

  /** Path as a person would say it: ~/experience rather than /home/raj/experience. */
  display(path: string): string {
    return tildify(normalizePath(path), this.home)
  }

  chdir(path: string): void {
    const old = this._cwd
    this._cwd = normalizePath(path)
    this.setVar('OLDPWD', old)
    this.setVar('PWD', this._cwd)
  }

  /** Friendly explanation after "Permission denied". */
  explainPermission(sink: Sink, path: string): void {
    const first = !this.flags.permissionHint
    this.flags.permissionHint = true
    const node = this.vfs.stat(path)
    if (node && path.endsWith('/.secrets')) {
      writeln(sink, dim(`Nice try. .secrets is ${modeString(node)} (mode 400): only its owner, raj, can read it. sudo won't help either.`))
      return
    }
    const parentPath = dirname(path)
    const parent = this.vfs.stat(parentPath)
    if (node && node.owner !== 'guest') {
      writeln(
        sink,
        dim(`${this.display(path)} belongs to ${node.owner} (${modeString(node)}). You're logged in as guest: you can read it, but not change, move or delete it.`),
      )
    } else if (parent) {
      writeln(
        sink,
        dim(`${this.display(parentPath)} belongs to ${parent.owner} (${modeString(parent)}): guests can look inside, but not create or delete files there.`),
      )
    }
    if (first) {
      writeln(
        sink,
        dim('Permissions read owner · group · everyone (r read, w write, x execute). See them with '),
        cmd('ls -l', 'ls -l'),
        dim('. /tmp is writable by everyone, so experiment there: '),
        cmd('cd /tmp', 'cd /tmp'),
      )
    }
  }

  // ── Commands ───────────────────────────────────────────────────────────────

  command(name: string): CommandDef | undefined {
    return this.registry.get(name)
  }

  /** Every command, including hidden aliases. */
  commandDefs(): CommandDef[] {
    return [...this.registry.values()]
  }

  binDir(def: CommandDef): string | null {
    return def.kind === 'builtin' ? null : def.kind === 'local' ? '/usr/local/bin' : '/bin'
  }

  /** Resolve a command name through builtins and $PATH. */
  lookupCommand(name: string, pathVar: string | undefined = this.getVar('PATH')): { def: CommandDef; path: string | null } | null {
    if (name.includes('/')) {
      const abs = this.resolve(name)
      const dir = dirname(abs)
      const def = this.registry.get(abs.slice(dir.length + 1))
      if (def && this.binDir(def) === dir && this.vfs.stat(abs)) return { def, path: abs }
      return null
    }
    const def = this.registry.get(name)
    if (!def) return null
    const dir = this.binDir(def)
    if (!dir) return { def, path: null }
    const dirs = (pathVar ?? '').split(':').map((d) => resolvePath(this._cwd, d || '.'))
    return dirs.includes(dir) ? { def, path: `${dir}/${name}` } : null
  }

  // ── Time, randomness, host ─────────────────────────────────────────────────

  now(): Date {
    return this.host.now?.() ?? new Date()
  }

  random(): number {
    return this.host.random?.() ?? Math.random()
  }

  columns(): number {
    return this.host.columns?.() ?? 80
  }

  get streamAnswer(): NonNullable<ShellHost['streamAnswer']> {
    return this.host.streamAnswer ?? defaultStreamAnswer
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (this.host.sleep) return this.host.sleep(ms, signal)
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve()
      const t = setTimeout(resolve, ms)
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(t)
          resolve()
        },
        { once: true },
      )
    })
  }

  // ── History ────────────────────────────────────────────────────────────────

  get history(): readonly string[] {
    return this._history
  }

  get historyOffset(): number {
    return this._historyOffset
  }

  clearHistory(): void {
    this._historyOffset += this._history.length
    this._history = []
  }

  private addHistory(line: string): void {
    if (this._history[this._history.length - 1] === line) return
    this._history.push(line)
    if (this._history.length > HISTORY_LIMIT) {
      this._history.shift()
      this._historyOffset++
    }
  }

  /** `!!`, `!n`, `!-n`, `!prefix`. Not inside single quotes; `\!` is literal. */
  expandHistory(line: string): { line: string } | { error: string } {
    if (!line.includes('!')) return { line }
    let out = ''
    let inSingle = false
    let inDouble = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '\\' && line[i + 1] === '!') {
        out += '\\!'
        i++
        continue
      }
      if (c === "'" && !inDouble) inSingle = !inSingle
      if (c === '"' && !inSingle) inDouble = !inDouble
      if (c !== '!' || inSingle) {
        out += c
        continue
      }
      const rest = line.slice(i + 1)
      let m: RegExpExecArray | null
      let entry: string | undefined
      let consumed = 0
      if (rest.startsWith('!')) {
        entry = this._history[this._history.length - 1]
        consumed = 1
      } else if ((m = /^-(\d+)/.exec(rest))) {
        entry = this._history[this._history.length - Number(m[1])]
        consumed = m[0].length
      } else if ((m = /^\d+/.exec(rest))) {
        entry = this._history[Number(m[0]) - 1 - this._historyOffset]
        consumed = m[0].length
      } else if ((m = /^[A-Za-z][\w.-]*/.exec(rest))) {
        const prefix = m[0]
        entry = [...this._history].reverse().find((h) => h.startsWith(prefix))
        consumed = m[0].length
      } else {
        out += c
        continue
      }
      if (entry === undefined) return { error: `!${rest.slice(0, consumed)}: event not found` }
      out += entry
      i += consumed
    }
    return { line: out }
  }

  // ── Prompt, boot, welcome ──────────────────────────────────────────────────

  prompt(): Segment[] {
    const ps1 = this.booted ? (this.getVar('PS1') ?? '') : DEFAULT_PS1
    return renderPrompt(ps1, {
      user: this.getVar('USER') ?? 'guest',
      hostname: HOSTNAME,
      cwd: this._cwd,
      home: this.home,
      now: this.now(),
      getVar: (n) => this.getVar(n),
    })
  }

  bootLog(): Line[] {
    const ok = (text: string): Line => [seg('[ ', 'dim'), seg('ok', 'accent'), seg(' ] ', 'dim'), seg(text)]
    const files = [...this.vfs.walk('/')].filter((p) => this.vfs.stat(p)?.type === 'file').length
    const profile = this.vfs.read(`${HOME}/.profile`)
    const exports = (profile.match(/^export /gm) ?? []).length
    const aliases = (profile.match(/^alias /gm) ?? []).length
    const lines: Line[] = [
      [seg('rsh 1.0', 'strong'), seg(` · ${HOSTNAME} · booting`, 'dim')],
      ok(`mounted / read-only from resume.ts (${files - this.restored.files} files)`),
      ok(`mounted overlay on /tmp from this browser (${this.restored.files} of your files)`),
      ok('login: USER=guest HOME=/home/raj SHELL=/bin/rsh'),
      ok(`sourced ~/.profile (${exports} exports, ${aliases} aliases)`),
    ]
    if (this.restored.history) lines.push(ok(`restored ${this.restored.history} history entries`))
    return lines
  }

  welcome(): Line[] {
    let motd: string[] = []
    try {
      motd = this.vfs.read('/etc/motd').split('\n').filter(Boolean)
    } catch {
      motd = []
    }
    const width = Math.max(...WELCOME_SUGGESTIONS.map(([c]) => c.length)) + 2
    const narrow = this.columns() < width + 24
    const lines: Line[] = []
    if (motd[0]) lines.push([strong(motd[0])])
    if (motd[1]) lines.push([dim(motd[1])])
    lines.push([])
    lines.push([seg('A real (small) shell: files, pipes, variables, quoting, redirects. Click or type:')])
    for (const [c, d] of WELCOME_SUGGESTIONS) {
      if (narrow) lines.push([seg('  '), cmd(c), seg('  '), dim(d)])
      else lines.push([seg('  '), cmd(c), seg(pad('', width - c.length)), dim(d)])
    }
    lines.push([])
    return lines
  }

  complete(line: string, cursor: number): Completion {
    return completeLine(this, line, cursor)
  }

  // ── Running ────────────────────────────────────────────────────────────────

  /**
   * Run one line typed by a person: history expansion, history, heredocs, `learn` checks and
   * persistence. Output streams to io.stdout / io.stderr.
   */
  async submit(line: string, io: ShellIO): Promise<number> {
    await this.ready
    if (!line.trim()) return this.lastStatus
    const ex = this.expandHistory(line)
    if ('error' in ex) {
      writeln(io.stderr, err(`rsh: ${ex.error}`))
      this.lastStatus = 1
      return 1
    }
    if (ex.line !== line) writeln(io.stdout, dim(ex.line))
    this.addHistory(ex.line)

    const capture = new BufferSink()
    const exec: ExecIO = {
      stdin: null,
      stdout: new TeeSink([io.stdout, capture]),
      stderr: new TeeSink([io.stderr, capture]),
      isTTY: true,
      signal: io.signal ?? new AbortController().signal,
      readLine: io.readLine ?? null,
    }
    this.trace = []
    const { status, parsed } = await this.runLineDetailed(ex.line, exec)
    if (this.learn.lesson !== null && !(this.trace[0]?.name === 'learn' && this.trace.length === 1)) {
      checkLearn(this, { line: ex.line, list: parsed, status, output: capture.text, trace: this.trace }, io.stdout)
    }
    this.persist()
    return status
  }

  /** Run a line non-interactively (no history, no learn). */
  async run(line: string, io: ShellIO): Promise<number> {
    await this.ready
    return this.runLine(line, {
      stdin: null,
      stdout: io.stdout,
      stderr: io.stderr,
      isTTY: true,
      signal: io.signal ?? new AbortController().signal,
      readLine: io.readLine ?? null,
    })
  }

  async runLine(line: string, io: ExecIO, opts: { nextLine?: () => string | null } = {}): Promise<number> {
    return (await this.runLineDetailed(line, io, opts)).status
  }

  private async runLineDetailed(
    line: string,
    io: ExecIO,
    opts: { nextLine?: () => string | null } = {},
  ): Promise<{ status: number; parsed: List | null }> {
    let parsed
    try {
      parsed = parse(line, { aliases: this.aliases })
    } catch (e) {
      if (e instanceof ShellSyntaxError) {
        writeln(io.stderr, err(`rsh: ${e.message}`))
        if (e.hint) writeln(io.stderr, dim(e.hint))
        this.lastStatus = 2
        return { status: 2, parsed: null }
      }
      throw e
    }
    const hd = await this.readHeredocs(parsed.heredocs, io, opts.nextLine)
    if (hd !== 0) {
      this.lastStatus = hd
      return { status: hd, parsed: parsed.list }
    }
    const status = await this.execList(parsed.list, io)
    this.lastStatus = status
    return { status, parsed: parsed.list }
  }

  /** Run a script's lines in this shell (used by `source` and at login). */
  async runScript(text: string, io: ExecIO): Promise<number> {
    const lines = text.split('\n')
    let i = 0
    let status = 0
    const nextLine = (): string | null => (i < lines.length ? lines[i++] : null)
    while (i < lines.length) {
      const line = lines[i++]
      if (!line.trim() || line.trim().startsWith('#')) continue
      status = await this.runLine(line, io, { nextLine })
      if (io.signal.aborted) return 130
    }
    return status
  }

  async sourceFile(path: string, io: ExecIO): Promise<number> {
    let text: string
    try {
      text = this.vfs.read(path)
    } catch (e) {
      if (e instanceof FsError) {
        writeln(io.stderr, err(`rsh: ${this.display(path)}: ${e.message}`))
        return 1
      }
      throw e
    }
    return this.runScript(text, io)
  }

  private async readHeredocs(heredocs: Redirect[], io: ExecIO, nextLine?: () => string | null): Promise<number> {
    for (const r of heredocs) {
      const hd = r.heredoc!
      const lines: string[] = []
      while (true) {
        let l: string | null
        if (nextLine) l = nextLine()
        else if (io.readLine) l = await io.readLine([seg('> ', 'dim')], { signal: io.signal })
        else {
          writeln(io.stderr, err('rsh: here-documents need someone at the keyboard'))
          return 1
        }
        if (io.signal.aborted) return 130
        if (l === null) {
          writeln(io.stderr, dim(`rsh: warning: here-document ended by end of input (wanted '${hd.delimiter}')`))
          break
        }
        if (l === hd.delimiter) break
        lines.push(l)
      }
      hd.body = lines.length ? lines.join('\n') + '\n' : ''
    }
    return 0
  }

  private async execList(list: List, io: ExecIO): Promise<number> {
    let status = this.lastStatus
    for (const item of list.items) {
      if (io.signal.aborted) return 130
      if (item.sep === '&' && !this.flags.background) {
        this.flags.background = true
        writeln(io.stderr, dim("rsh: background jobs (&) aren't supported here, so this runs in the foreground."))
      }
      status = await this.execAndOr(item.andOr, io)
      this.lastStatus = status
    }
    return status
  }

  private async execAndOr(ao: AndOr, io: ExecIO): Promise<number> {
    let status = await this.execPipeline(ao.first, io)
    this.lastStatus = status
    for (const { op, pipeline } of ao.rest) {
      if (io.signal.aborted) return 130
      if ((op === '&&' && status !== 0) || (op === '||' && status === 0)) continue
      status = await this.execPipeline(pipeline, io)
      this.lastStatus = status
    }
    return status
  }

  private async execPipeline(p: Pipeline, io: ExecIO): Promise<number> {
    let status: number
    if (p.commands.length === 1) {
      status = await this.execCommand(p.commands[0], io)
    } else {
      // Every stage of a real pipeline runs in its own subshell: `cd /tmp | ls` changes nothing.
      let input = io.stdin
      status = 0
      for (let i = 0; i < p.commands.length; i++) {
        const last = i === p.commands.length - 1
        const sink = last ? io.stdout : new BufferSink()
        status = await this.withSubshell(() =>
          this.execCommand(p.commands[i], { ...io, stdin: input, stdout: sink, isTTY: last ? io.isTTY : false }),
        )
        if (io.signal.aborted) return 130
        if (!last) input = (sink as BufferSink).text
      }
    }
    if (io.signal.aborted) return 130
    return p.negate ? (status === 0 ? 1 : 0) : status
  }

  private async execCommand(c: Command, io: ExecIO): Promise<number> {
    if (c.type === 'simple') return this.execSimple(c, io)
    return this.withSubshell(async () => {
      const entry: TraceEntry = { name: '(', args: [], status: 0, assigns: [], redirects: [] }
      const redir = await this.openRedirects(c.redirects, io, this.expandCtx(io), entry)
      if (typeof redir === 'number') return redir
      const status = await this.execList(c.body, redir.io)
      return redir.finish() || status
    })
  }

  async withSubshell<T>(fn: () => Promise<T>): Promise<T> {
    const vars = new Map([...this.vars].map(([k, v]) => [k, { ...v }]))
    const aliases = new Map(this.aliases)
    const cwd = this._cwd
    this.subshellDepth++
    try {
      return await fn()
    } finally {
      this.subshellDepth--
      this.vars = vars
      this.aliases.clear()
      for (const [k, v] of aliases) this.aliases.set(k, v)
      this._cwd = cwd
    }
  }

  private expandCtx(io: ExecIO): ExpandContext {
    return {
      getVar: (n) => this.getVar(n),
      setVar: (n, v) => this.setVar(n, v),
      home: this.home,
      substitute: (src) => this.substitute(src, io),
      glob: (pattern) => expandGlob(pattern, this.vfs, this._cwd),
    }
  }

  private async substitute(source: string, io: ExecIO): Promise<string> {
    const buf = new BufferSink()
    await this.withSubshell(() => this.runLine(source, { ...io, stdin: null, stdout: buf, isTTY: false }))
    this.lastSubstStatus = this.lastStatus
    return buf.text
  }

  private reportError(e: unknown, io: ExecIO): number {
    if (e instanceof ExpansionError) {
      writeln(io.stderr, err(`rsh: ${e.message}`))
      return 1
    }
    if (isAbort(e) || io.signal.aborted) return 130
    throw e
  }

  private async execSimple(cmd: SimpleCommand, io: ExecIO): Promise<number> {
    const ectx = this.expandCtx(io)
    this.lastSubstStatus = null
    let argv: string[]
    const assigns: [string, string][] = []
    try {
      argv = await expandWords(cmd.words, ectx)
      for (const a of cmd.assigns) assigns.push([a.name, (await expandWord(a.value, ectx, { split: false }))[0]])
    } catch (e) {
      return this.reportError(e, io)
    }
    if (io.signal.aborted) return 130

    const entry: TraceEntry = { name: argv[0] ?? '', args: argv.slice(1), status: 0, assigns: assigns.map((a) => a[0]), redirects: [] }
    this.trace.push(entry)

    const redir = await this.openRedirects(cmd.redirects, io, ectx, entry)
    if (typeof redir === 'number') {
      entry.status = redir
      return redir
    }
    let status: number
    if (!argv.length) {
      for (const [n, v] of assigns) this.setVar(n, v)
      status = this.lastSubstStatus ?? 0
    } else {
      status = await this.invoke(argv, assigns, redir.io)
    }
    status = redir.finish() || status
    entry.status = status
    return status
  }

  /** Run an already-expanded command (used by `env NAME=value cmd`). */
  execArgv(argv: string[], assigns: [string, string][], io: ExecIO): Promise<number> {
    return this.invoke(argv, assigns, io)
  }

  private async invoke(argv: string[], assigns: [string, string][], io: ExecIO): Promise<number> {
    const [name, ...args] = argv
    const env = { ...this.exportedVars(), ...Object.fromEntries(assigns) }
    const found = this.lookupCommand(name, env.PATH)
    if (!found) return this.notFound(name, args, env, io)
    const ctx: CommandContext = {
      name: found.def.name,
      args,
      env,
      stdin: io.stdin,
      stdout: io.stdout,
      stderr: io.stderr,
      isTTY: io.isTTY,
      signal: io.signal,
      readLine: io.readLine,
      shell: this,
    }
    try {
      return await found.def.run(ctx)
    } catch (e) {
      if (isAbort(e) || io.signal.aborted) return 130
      if (e instanceof FsError) {
        writeln(io.stderr, err(`${ctx.name}: ${this.display(e.path)}: ${e.message}`))
        return 1
      }
      writeln(io.stderr, err(`${ctx.name}: ${e instanceof Error ? e.message : String(e)}`))
      return 1
    }
  }

  private notFound(name: string, args: string[], env: Record<string, string>, io: ExecIO): number {
    if (name.includes('/')) {
      const node = this.vfs.stat(this.resolve(name))
      if (!node) {
        writeln(io.stderr, err(`rsh: ${name}: No such file or directory`))
        return 127
      }
      writeln(io.stderr, err(`rsh: ${name}: ${node.type === 'dir' ? 'Is a directory' : 'Permission denied'}`))
      if (node.type === 'file') {
        writeln(io.stderr, dim("Files here aren't programs. To run the commands inside a file, use "), cmd(`source ${name}`, `source ${name}`))
      }
      return 126
    }
    const def = this.registry.get(name)
    if (def && def.kind !== 'builtin') {
      writeln(io.stderr, err(`rsh: command not found: ${name}`))
      writeln(
        io.stderr,
        dim(`${name} lives in ${this.binDir(def)}, which isn't in your PATH (${env.PATH === undefined ? 'unset' : `'${env.PATH}'`}). Fix it: `),
        cmd('export PATH=/usr/local/bin:/bin'),
      )
      return 127
    }
    const candidates = [...this.registry.values()].filter((c) => !c.hidden).map((c) => c.name)
    const guess = suggest(name, [...candidates, ...this.aliases.keys()])
    if (guess) {
      const fixed = [guess, ...args.map(quoteArg)].join(' ')
      writeln(io.stderr, err(`rsh: command not found: ${name} — did you mean `), cmd(fixed, guess), err('?'))
    } else {
      writeln(io.stderr, err(`rsh: command not found: ${name}`))
      writeln(io.stderr, dim('Type '), cmd('help'), dim(' to see every command.'))
    }
    return 127
  }

  private async openRedirects(
    redirects: Redirect[],
    io: ExecIO,
    ectx: ExpandContext,
    entry: TraceEntry,
  ): Promise<{ io: ExecIO; finish: () => number } | number> {
    if (!redirects.length) return { io, finish: () => 0 }
    let { stdin, stdout, stderr, isTTY } = io
    const outputs: { path: string; shown: string; buf: BufferSink }[] = []
    for (const r of redirects) {
      if (r.op === '<<') {
        const hd = r.heredoc!
        stdin = hd.quoted ? (hd.body ?? '') : expandVarsInText(hd.body ?? '', (n) => this.getVar(n))
        continue
      }
      let target: string
      try {
        target = (await expandWord(r.target, ectx, { split: false }))[0]
      } catch (e) {
        return this.reportError(e, io)
      }
      if (r.op === '>&' || r.op === '<&') {
        if (target === '1' && r.fd === 2) stderr = stdout
        else if (target === '2' && r.fd === 1) {
          stdout = stderr
          isTTY = io.isTTY
        } else if (target !== '1' && target !== '2' && target !== '0') {
          writeln(io.stderr, err(`rsh: ${r.raw}: only 2>&1 and 1>&2 are supported`))
          return 1
        }
        continue
      }
      const abs = this.resolve(target)
      entry.redirects.push({ op: r.op, fd: r.fd, path: abs })
      if (r.op === '<') {
        try {
          stdin = this.vfs.read(abs)
        } catch (e) {
          return this.redirectFail(target, e, io)
        }
        continue
      }
      try {
        if (r.op === '>' || !this.vfs.stat(abs)) this.vfs.write(abs, '')
        else this.vfs.write(abs, '', { append: true })
      } catch (e) {
        return this.redirectFail(target, e, io)
      }
      const buf = abs === '/dev/null' ? null : new BufferSink()
      const sink = buf ?? DISCARD
      if (r.fd === 2) stderr = sink
      else {
        stdout = sink
        isTTY = false
      }
      if (buf) outputs.push({ path: abs, shown: target, buf })
    }
    return {
      io: { ...io, stdin, stdout, stderr, isTTY },
      finish: () => {
        let status = 0
        for (const o of outputs) {
          if (!o.buf.text) continue
          try {
            this.vfs.write(o.path, o.buf.text, { append: true })
          } catch (e) {
            status = this.redirectFail(o.shown, e, io)
          }
        }
        return status
      },
    }
  }

  private redirectFail(shown: string, e: unknown, io: ExecIO): number {
    if (!(e instanceof FsError)) throw e
    writeln(io.stderr, err(`rsh: ${shown}: ${e.message}`))
    if (e.code === 'EACCES') this.explainPermission(io.stderr, e.path)
    if (e.code === 'ENOSPC') writeln(io.stderr, dim('Your files are capped at 200 KB. Free space with rm, or run reset.'))
    return 1
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private loadSaved(): SavedState | null {
    const raw = (() => {
      try {
        return this.host.storage?.load() ?? null
      } catch {
        return null
      }
    })()
    if (!raw) return null
    try {
      const data = JSON.parse(raw) as Partial<SavedState>
      if (!data || data.v !== 1) return null
      return {
        v: 1,
        history: Array.isArray(data.history) ? data.history.filter((h): h is string => typeof h === 'string') : [],
        historyOffset: typeof data.historyOffset === 'number' ? data.historyOffset : 0,
        env: data.env && typeof data.env === 'object' ? data.env : {},
        aliases: data.aliases && typeof data.aliases === 'object' ? data.aliases : {},
        files: data.files && typeof data.files === 'object' ? data.files : {},
        learn: sanitizeLearn(data.learn),
      }
    } catch {
      return null
    }
  }

  persist(): void {
    const storage = this.host.storage
    if (!storage || !this.booted) return
    const env: Record<string, string | null> = {}
    const now = this.exportedVars()
    for (const [k, v] of Object.entries(now)) if (!VOLATILE_ENV.has(k) && this.baseline.env[k] !== v) env[k] = v
    for (const k of Object.keys(this.baseline.env)) if (!(k in now) && !VOLATILE_ENV.has(k)) env[k] = null
    const aliases: Record<string, string | null> = {}
    for (const [k, v] of this.aliases) if (this.baseline.aliases[k] !== v) aliases[k] = v
    for (const k of Object.keys(this.baseline.aliases)) if (!this.aliases.has(k)) aliases[k] = null
    const data: SavedState = {
      v: 1,
      history: this._history.slice(-HISTORY_LIMIT),
      historyOffset: this._historyOffset,
      env,
      aliases,
      files: this.vfs.serialize(),
      learn: this.learn,
    }
    try {
      storage.save(JSON.stringify(data))
    } catch {
      // Storage full or disabled: the session still works, it just won't persist.
    }
  }

  /** Wipe everything the visitor changed and log in fresh. */
  async resetAll(): Promise<void> {
    try {
      this.host.storage?.clear()
    } catch {
      // ignore
    }
    this._history = []
    this._historyOffset = 0
    this.vfs.clearOverlay()
    this.learn = emptyLearn()
    this.conversation = []
    this.vars.clear()
    this.aliases.clear()
    this.flags.cloneNotice = false
    this.flags.permissionHint = false
    this.restored = { history: 0, files: 0 }
    this.loginVars()
    await this.sourceFile(`${HOME}/.profile`, this.silentIO())
    this.baseline = { env: this.exportedVars(), aliases: Object.fromEntries(this.aliases) }
  }

  /** True when the file at `path` may be written by the visitor. */
  canWritePath(path: string): boolean {
    const node = this.vfs.stat(path)
    if (node) return canWrite(node)
    const parent = this.vfs.stat(dirname(path))
    return !!parent && parent.type === 'dir' && canWrite(parent)
  }
}
