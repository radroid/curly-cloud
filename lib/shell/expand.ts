/**
 * Word expansion, in the POSIX order: tilde → parameters, command substitution and arithmetic →
 * field splitting (unquoted expansions only) → globbing → quote removal.
 */
import { escapeGlob, hasGlob, unescapeGlob } from './glob'
import type { Word, WordPart } from './lexer'

export class ExpansionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpansionError'
  }
}

export interface ExpandContext {
  getVar(name: string): string | undefined
  setVar(name: string, value: string): void
  home: string
  /** Run `source` in a subshell and return its stdout. */
  substitute(source: string): Promise<string>
  /** Expand a glob pattern (backslash-escaped) against the filesystem. */
  glob(pattern: string): string[]
}

interface Piece {
  text: string
  quoted: boolean
  /** Unquoted expansion results are split on whitespace. */
  split: boolean
}

interface Field {
  text: string
  pattern: string
  glob: boolean
  quoted: boolean
}

const TILDE_USERS: Record<string, true> = { '': true, raj: true }

async function expandParam(part: Extract<WordPart, { type: 'param' }>, ctx: ExpandContext): Promise<string> {
  const value = ctx.getVar(part.name)
  const arg = (): string => part.arg.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, n: string) => ctx.getVar(n) ?? '')
  switch (part.op) {
    case 'length':
      return String([...(value ?? '')].length)
    case ':-':
      return value ? value : arg()
    case '-':
      return value !== undefined ? value : arg()
    case ':+':
      return value ? arg() : ''
    case ':=':
      if (!value) {
        const v = arg()
        ctx.setVar(part.name, v)
        return v
      }
      return value
    default:
      return value ?? ''
  }
}

async function partToPieces(part: WordPart, ctx: ExpandContext): Promise<Piece[]> {
  switch (part.type) {
    case 'text':
      return [{ text: part.text, quoted: part.quote !== 'none', split: false }]
    case 'tilde':
      if (TILDE_USERS[part.user]) return [{ text: ctx.home, quoted: true, split: false }]
      return [{ text: part.raw, quoted: false, split: false }]
    case 'param':
      return [{ text: await expandParam(part, ctx), quoted: part.quoted, split: !part.quoted }]
    case 'subst': {
      const out = (await ctx.substitute(part.source)).replace(/\n+$/, '')
      return [{ text: out, quoted: part.quoted, split: !part.quoted }]
    }
    case 'arith':
      return [{ text: String(evalArithmetic(part.expr, ctx)), quoted: part.quoted, split: !part.quoted }]
  }
}

/**
 * Expand a word into zero or more fields. With `split: false` (assignments, redirect targets)
 * the result is always exactly one field and no globbing happens.
 */
export async function expandWord(
  word: Word,
  ctx: ExpandContext,
  opts: { split?: boolean; glob?: boolean } = {},
): Promise<string[]> {
  const split = opts.split ?? true
  const glob = opts.glob ?? true
  const pieces: Piece[] = []
  for (const part of word.parts) pieces.push(...(await partToPieces(part, ctx)))
  if (!split) return [pieces.map((p) => p.text).join('')]

  const fields: Field[] = []
  let cur: Field | null = null
  const ensure = (): Field => (cur ??= { text: '', pattern: '', glob: false, quoted: false })
  const add = (text: string, quoted: boolean): void => {
    const f = ensure()
    f.text += text
    f.pattern += quoted ? escapeGlob(text) : text
    if (quoted) f.quoted = true
  }
  for (const piece of pieces) {
    if (!piece.split) {
      add(piece.text, piece.quoted)
      continue
    }
    const chunks = piece.text.split(/[ \t\n]+/)
    chunks.forEach((chunk, i) => {
      if (i > 0 && cur) {
        fields.push(cur)
        cur = null
      }
      if (chunk) add(chunk, false)
    })
  }
  if (cur) fields.push(cur)

  const out: string[] = []
  for (const f of fields) {
    if (!f.text && !f.quoted) continue
    if (glob && hasGlob(f.pattern)) {
      const matches = ctx.glob(f.pattern)
      if (matches.length) {
        out.push(...matches)
        continue
      }
      out.push(unescapeGlob(f.pattern))
      continue
    }
    out.push(f.text)
  }
  return out
}

/** Expand a list of words into argv. */
export async function expandWords(words: Word[], ctx: ExpandContext): Promise<string[]> {
  const out: string[] = []
  for (const w of words) out.push(...(await expandWord(w, ctx)))
  return out
}

/** Expand `$VAR` / `${VAR}` in heredoc bodies and prompts (no command substitution). */
export function expandVarsInText(text: string, getVar: (name: string) => string | undefined): string {
  return text.replace(/\\\$|\$\{([A-Za-z_][A-Za-z0-9_]*|[?$#0-9])\}|\$([A-Za-z_][A-Za-z0-9_]*|[?$#0-9])/g, (m, a?: string, b?: string) => {
    if (m === '\\$') return '$'
    return getVar((a ?? b) as string) ?? ''
  })
}

// ── Arithmetic: $(( 1 + 2 * (x - 3) )) ──────────────────────────────────────

export function evalArithmetic(expr: string, ctx: Pick<ExpandContext, 'getVar'>): number {
  const src = expr.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*|[?$#])\}?/g, (_, n: string) => ctx.getVar(n) || '0')
  const tokens = src.match(/\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|[-+*/%()]|\S/g) ?? []
  let pos = 0
  const fail = (): never => {
    throw new ExpansionError(`arithmetic syntax error in "${expr.trim()}"`)
  }
  const peek = (): string | undefined => tokens[pos]
  const primary = (): number => {
    const t = tokens[pos++]
    if (t === undefined) return fail()
    if (t === '(') {
      const v = sum()
      if (tokens[pos++] !== ')') fail()
      return v
    }
    if (t === '-') return -primary()
    if (t === '+') return primary()
    if (/^\d+$/.test(t)) return Number(t)
    if (/^[A-Za-z_]/.test(t)) {
      const v = Number(ctx.getVar(t) || '0')
      return Number.isFinite(v) ? Math.trunc(v) : 0
    }
    return fail()
  }
  const power = (): number => {
    const base = primary()
    if (peek() === '**') {
      pos++
      return base ** power()
    }
    return base
  }
  const product = (): number => {
    let v = power()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = tokens[pos++]
      const r = power()
      if ((op === '/' || op === '%') && r === 0) throw new ExpansionError('division by 0')
      v = op === '*' ? v * r : op === '/' ? Math.trunc(v / r) : v % r
    }
    return v
  }
  const sum = (): number => {
    let v = product()
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++]
      const r = product()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  if (!tokens.length) return 0
  const result = sum()
  if (pos !== tokens.length) fail()
  return result
}
