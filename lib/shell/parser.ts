/**
 * Parser for rsh. Grammar (a small POSIX subset):
 *
 *   list     := and_or ((';' | '&') and_or)* [';' | '&']
 *   and_or   := pipeline (('&&' | '||') pipeline)*
 *   pipeline := ['!'] command ('|' command)*
 *   command  := '(' list ')' redirect* | simple
 *   simple   := (assignment | word | redirect)+       assignments only before the command name
 */
import { isPlainWord, lex, literalText, ShellSyntaxError, type OpKind, type Token, type Word, type WordPart } from './lexer'

export type RedirectOp = '>' | '>>' | '<' | '<<' | '>&' | '<&'

export interface Assignment {
  name: string
  value: Word
  raw: string
  start: number
  end: number
}

export interface Redirect {
  op: RedirectOp
  fd: number
  target: Word
  raw: string
  start: number
  end: number
  heredoc?: { delimiter: string; quoted: boolean; body: string | null }
}

export interface SimpleCommand {
  type: 'simple'
  assigns: Assignment[]
  words: Word[]
  redirects: Redirect[]
  /** Set when the command name came from an alias, e.g. `ll` → `ls -la`. */
  alias: { name: string; value: string } | null
  start: number
  end: number
}

export interface Subshell {
  type: 'subshell'
  body: List
  redirects: Redirect[]
  start: number
  end: number
}

export type Command = SimpleCommand | Subshell

export interface Pipeline {
  negate: boolean
  commands: Command[]
  start: number
  end: number
}

export interface AndOr {
  first: Pipeline
  rest: { op: '&&' | '||'; pipeline: Pipeline }[]
}

export interface ListItem {
  andOr: AndOr
  sep: ';' | '&' | null
}

export interface List {
  items: ListItem[]
}

export interface ParseResult {
  list: List
  /** Heredoc redirects in source order; bodies are read by the shell before running. */
  heredocs: Redirect[]
  comment: string | null
  tokens: Token[]
}

export interface ParseOptions {
  aliases?: ReadonlyMap<string, string>
}

const REDIRECT_OPS = new Set<OpKind>(['>', '>>', '<', '<<', '>&', '<&'])
const ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=/

const OP_HINTS: Partial<Record<OpKind, string>> = {
  '|': 'a pipe needs a command on both sides, e.g. ls | wc -l',
  '&&': '&& goes between two commands, e.g. cd builds && ls',
  '||': '|| goes between two commands, e.g. cat x || echo missing',
  ';': '; separates two commands, e.g. pwd; ls',
  ')': 'there is no ( for this ) to close',
}

export function parse(input: string, opts: ParseOptions = {}): ParseResult {
  const tokens = lex(input)
  const comment = tokens.find((t) => t.kind === 'comment')
  const stream = tokens.filter((t) => t.kind !== 'comment')
  const parser = new Parser(stream, opts.aliases ?? new Map())
  const list = parser.parseProgram()
  return { list, heredocs: parser.heredocs, comment: comment && comment.kind === 'comment' ? comment.text : null, tokens }
}

function tokenStart(t: Token | undefined): number {
  if (!t) return 0
  return t.kind === 'word' ? t.word.start : t.start
}

function describe(t: Token | undefined): string {
  if (!t) return 'newline'
  if (t.kind === 'op') return t.raw
  if (t.kind === 'word') return t.word.raw
  return '#'
}

class Parser {
  private pos = 0
  readonly heredocs: Redirect[] = []

  constructor(
    private readonly tokens: Token[],
    private readonly aliases: ReadonlyMap<string, string>,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private isOp(t: Token | undefined, ...ops: OpKind[]): t is Extract<Token, { kind: 'op' }> {
    return !!t && t.kind === 'op' && (ops.length === 0 || ops.includes(t.op))
  }

  private unexpected(t: Token | undefined, after?: string): never {
    if (!t) {
      throw new ShellSyntaxError(
        after ? `syntax error: unexpected end of line after '${after}'` : 'syntax error: unexpected end of line',
        after ? (OP_HINTS[after as OpKind] ?? null) : null,
        null,
      )
    }
    const hint = t.kind === 'op' ? (OP_HINTS[t.op] ?? null) : null
    throw new ShellSyntaxError(`syntax error near unexpected token '${describe(t)}'`, hint, tokenStart(t))
  }

  parseProgram(): List {
    if (!this.peek()) return { items: [] }
    const list = this.parseList(false)
    if (this.peek()) this.unexpected(this.peek())
    return list
  }

  private parseList(inSubshell: boolean): List {
    const items: ListItem[] = []
    while (this.peek()) {
      if (inSubshell && this.isOp(this.peek(), ')')) break
      const andOr = this.parseAndOr()
      let sep: ListItem['sep'] = null
      const t = this.peek()
      if (this.isOp(t, ';', '&')) {
        sep = t.op as ';' | '&'
        this.pos++
      }
      items.push({ andOr, sep })
      if (sep === null) break
    }
    return { items }
  }

  private parseAndOr(): AndOr {
    const first = this.parsePipeline()
    const rest: AndOr['rest'] = []
    while (this.isOp(this.peek(), '&&', '||')) {
      const op = (this.peek() as Extract<Token, { kind: 'op' }>).op as '&&' | '||'
      this.pos++
      if (!this.peek()) this.unexpected(undefined, op)
      rest.push({ op, pipeline: this.parsePipeline() })
    }
    return { first, rest }
  }

  private parsePipeline(): Pipeline {
    let negate = false
    const t = this.peek()
    const start = tokenStart(t)
    if (t && t.kind === 'word' && isPlainWord(t.word) && t.word.raw === '!') {
      negate = true
      this.pos++
    }
    const commands: Command[] = [this.parseCommand()]
    while (this.isOp(this.peek(), '|')) {
      this.pos++
      if (!this.peek()) this.unexpected(undefined, '|')
      commands.push(this.parseCommand())
    }
    return { negate, commands, start, end: commands[commands.length - 1].end }
  }

  private parseCommand(): Command {
    const t = this.peek()
    if (this.isOp(t, '(')) {
      this.pos++
      const body = this.parseList(true)
      const close = this.peek()
      if (!this.isOp(close, ')')) {
        throw new ShellSyntaxError('syntax error: missing ) to close the subshell', 'e.g. (cd /tmp && ls)', t.start)
      }
      if (body.items.length === 0) this.unexpected(close)
      this.pos++
      const redirects: Redirect[] = []
      while (this.isOp(this.peek(), ...REDIRECT_OPS)) redirects.push(this.parseRedirect())
      return { type: 'subshell', body, redirects, start: t.start, end: redirects.length ? redirects[redirects.length - 1].end : close.end }
    }
    return this.parseSimple()
  }

  private parseSimple(): SimpleCommand {
    const assigns: Assignment[] = []
    const words: Word[] = []
    const redirects: Redirect[] = []
    const expanded = new Set<string>()
    let alias: SimpleCommand['alias'] = null
    const start = tokenStart(this.peek())
    let end = start
    while (true) {
      const t = this.peek()
      if (!t) break
      if (t.kind === 'op') {
        if (!REDIRECT_OPS.has(t.op)) break
        const r = this.parseRedirect()
        redirects.push(r)
        end = r.end
        continue
      }
      if (t.kind !== 'word') break
      if (words.length === 0) {
        const assignment = asAssignment(t.word)
        if (assignment) {
          assigns.push(assignment)
          end = t.word.end
          this.pos++
          continue
        }
        const name = t.word.raw
        const value = isPlainWord(t.word) ? this.aliases.get(name) : undefined
        if (value !== undefined && !expanded.has(name)) {
          expanded.add(name)
          if (!alias) alias = { name, value }
          let replacement: Token[]
          try {
            replacement = lex(value).filter((x) => x.kind !== 'comment')
          } catch {
            replacement = [t]
          }
          // Alias tokens keep the alias word's position so errors and `explain` point at what was typed.
          for (const r of replacement) {
            if (r.kind === 'word') r.word = { ...r.word, start: t.word.start, end: t.word.end }
            else if (r.kind === 'op') Object.assign(r, { start: t.word.start, end: t.word.end })
          }
          this.tokens.splice(this.pos, 1, ...replacement)
          continue
        }
      }
      words.push(t.word)
      end = t.word.end
      this.pos++
    }
    if (!assigns.length && !words.length && !redirects.length) this.unexpected(this.peek())
    return { type: 'simple', assigns, words, redirects, alias, start, end }
  }

  private parseRedirect(): Redirect {
    const t = this.peek() as Extract<Token, { kind: 'op' }>
    this.pos++
    const target = this.peek()
    if (!target || target.kind !== 'word') {
      if (!target) {
        throw new ShellSyntaxError(
          `syntax error: '${t.raw}' needs a file name after it`,
          t.op === '<' ? 'e.g. sort < names.txt' : 'e.g. echo hi > /tmp/hi.txt',
          t.start,
        )
      }
      this.unexpected(target)
    }
    this.pos++
    const op = t.op as RedirectOp
    const fd = t.fd ?? (op === '<' || op === '<<' || op === '<&' ? 0 : 1)
    const raw = `${t.raw}${target.word.start > t.end ? ' ' : ''}${target.word.raw}`
    const r: Redirect = { op, fd, target: target.word, raw, start: t.start, end: target.word.end }
    if (op === '<<') {
      const quoted = target.word.parts.some((p) => p.type === 'text' && p.quote !== 'none')
      r.heredoc = { delimiter: literalText(target.word), quoted, body: null }
      this.heredocs.push(r)
    }
    return r
  }
}

/** `NAME=value` (unquoted name) → assignment; anything else → null. */
export function asAssignment(word: Word): Assignment | null {
  const first = word.parts[0]
  if (!first || first.type !== 'text' || first.quote !== 'none') return null
  const m = ASSIGN_RE.exec(first.text)
  if (!m) return null
  const restText = first.text.slice(m[0].length)
  const parts: WordPart[] = []
  if (restText) parts.push({ type: 'text', text: restText, quote: 'none' })
  parts.push(...word.parts.slice(1))
  const valueStart = word.start + m[0].length
  return {
    name: m[1],
    value: { parts, raw: word.raw.slice(m[0].length), start: valueStart, end: word.end },
    raw: word.raw,
    start: word.start,
    end: word.end,
  }
}

/** Every simple command in a list, in source order (descends into subshells). */
export function simpleCommands(list: List): SimpleCommand[] {
  const out: SimpleCommand[] = []
  const visit = (l: List): void => {
    for (const item of l.items) {
      for (const p of [item.andOr.first, ...item.andOr.rest.map((r) => r.pipeline)]) {
        for (const c of p.commands) {
          if (c.type === 'simple') out.push(c)
          else visit(c.body)
        }
      }
    }
  }
  visit(list)
  return out
}

export function pipelines(list: List): Pipeline[] {
  const out: Pipeline[] = []
  for (const item of list.items) {
    out.push(item.andOr.first, ...item.andOr.rest.map((r) => r.pipeline))
    for (const p of [item.andOr.first, ...item.andOr.rest.map((r) => r.pipeline)]) {
      for (const c of p.commands) if (c.type === 'subshell') out.push(...pipelines(c.body))
    }
  }
  return out
}
