/**
 * Tokenizer for rsh. Turns a command line into words and operators while keeping enough
 * structure (which parts were quoted, which are expansions) for correct expansion later and
 * for `explain` to annotate each piece.
 */

export type QuoteKind = 'none' | 'single' | 'double' | 'escape'

export type ParamOp = '' | ':-' | '-' | ':+' | ':=' | 'length'

export type WordPart =
  | { type: 'text'; text: string; quote: QuoteKind }
  | { type: 'param'; name: string; op: ParamOp; arg: string; braced: boolean; quoted: boolean; raw: string }
  | { type: 'subst'; source: string; quoted: boolean; raw: string }
  | { type: 'arith'; expr: string; quoted: boolean; raw: string }
  | { type: 'tilde'; user: string; raw: string }

export interface Word {
  parts: WordPart[]
  raw: string
  start: number
  end: number
}

export type OpKind = '|' | '||' | '&&' | '&' | ';' | '(' | ')' | '>' | '>>' | '<' | '<<' | '>&' | '<&'

export type Token =
  | { kind: 'word'; word: Word }
  | { kind: 'op'; op: OpKind; fd: number | null; raw: string; start: number; end: number }
  | { kind: 'comment'; text: string; start: number; end: number }

export class ShellSyntaxError extends Error {
  constructor(
    message: string,
    readonly hint: string | null = null,
    readonly pos: number | null = null,
  ) {
    super(message)
    this.name = 'ShellSyntaxError'
  }
}

const OP_CHARS = new Set(['|', '&', ';', '<', '>', '(', ')'])
const TWO_CHAR_OPS = new Set(['||', '&&', '>>', '<<', '>&', '<&'])
const SPECIAL_PARAMS = new Set(['?', '$', '#', '!', '@', '*', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
const NAME_START = /[A-Za-z_]/
const NAME_CHAR = /[A-Za-z0-9_]/

/** Index of the ')' matching an already-open '(' whose contents start at `from`, or -1. */
export function findClosingParen(input: string, from: number): number {
  let depth = 1
  let j = from
  while (j < input.length) {
    const ch = input[j]
    if (ch === '\\') {
      j += 2
      continue
    }
    if (ch === "'") {
      const close = input.indexOf("'", j + 1)
      if (close === -1) return -1
      j = close + 1
      continue
    }
    if (ch === '"') {
      j++
      while (j < input.length && input[j] !== '"') j += input[j] === '\\' ? 2 : 1
      if (j >= input.length) return -1
      j++
      continue
    }
    if (ch === '(') depth++
    if (ch === ')') {
      depth--
      if (depth === 0) return j
    }
    j++
  }
  return -1
}

export function lex(input: string): Token[] {
  const tokens: Token[] = []
  let parts: WordPart[] | null = null
  let wordStart = 0
  let i = 0

  const startWord = (pos: number): WordPart[] => {
    if (!parts) {
      parts = []
      wordStart = pos
    }
    return parts
  }
  const endWord = (pos: number): void => {
    if (parts) tokens.push({ kind: 'word', word: { parts, raw: input.slice(wordStart, pos), start: wordStart, end: pos } })
    parts = null
  }
  const pushText = (text: string, quote: QuoteKind): void => {
    const p = startWord(i)
    const last = p[p.length - 1]
    if (last && last.type === 'text' && last.quote === quote) last.text += text
    else p.push({ type: 'text', text, quote })
  }

  /** Parses `$…` at `at`; returns the index after it. */
  const lexDollar = (at: number, quoted: boolean): number => {
    const p = startWord(at)
    const next = input[at + 1]
    if (next === '(') {
      if (input[at + 2] === '(') {
        const close = findClosingParen(input, at + 2)
        if (close !== -1 && input[close - 1] === ')' && close - 1 >= at + 3) {
          // $(( expr )): the outer paren closes at `close`, the inner one just before it.
          const inner = findClosingParen(input, at + 3)
          if (inner === close - 1) {
            p.push({ type: 'arith', expr: input.slice(at + 3, close - 1), quoted, raw: input.slice(at, close + 1) })
            return close + 1
          }
        }
      }
      const close = findClosingParen(input, at + 2)
      if (close === -1) {
        throw new ShellSyntaxError('unterminated command substitution: missing )', 'close it, e.g. echo $(pwd)', at)
      }
      p.push({ type: 'subst', source: input.slice(at + 2, close), quoted, raw: input.slice(at, close + 1) })
      return close + 1
    }
    if (next === '{') {
      const close = input.indexOf('}', at + 2)
      if (close === -1) throw new ShellSyntaxError('unterminated ${ : missing }', 'close it, e.g. echo ${HOME}', at)
      const body = input.slice(at + 2, close)
      const raw = input.slice(at, close + 1)
      const m = /^(#?)([A-Za-z_][A-Za-z0-9_]*|[?$#0-9])(?:(:-|-|:\+|:=)(.*))?$/s.exec(body)
      if (!m || (m[1] && m[3])) throw new ShellSyntaxError(`bad substitution: ${raw}`, 'use ${NAME}, ${NAME:-default} or ${#NAME}', at)
      const op: ParamOp = m[1] ? 'length' : ((m[3] ?? '') as ParamOp)
      p.push({ type: 'param', name: m[2], op, arg: m[4] ?? '', braced: true, quoted, raw })
      return close + 1
    }
    if (next !== undefined && SPECIAL_PARAMS.has(next)) {
      p.push({ type: 'param', name: next, op: '', arg: '', braced: false, quoted, raw: '$' + next })
      return at + 2
    }
    if (next !== undefined && NAME_START.test(next)) {
      let j = at + 1
      while (j < input.length && NAME_CHAR.test(input[j])) j++
      const name = input.slice(at + 1, j)
      p.push({ type: 'param', name, op: '', arg: '', braced: false, quoted, raw: '$' + name })
      return j
    }
    pushText('$', quoted ? 'double' : 'none')
    return at + 1
  }

  const lexBacktick = (at: number, quoted: boolean): number => {
    const close = input.indexOf('`', at + 1)
    if (close === -1) throw new ShellSyntaxError('unterminated backquote: missing `', 'prefer $(…), e.g. echo $(pwd)', at)
    startWord(at).push({ type: 'subst', source: input.slice(at + 1, close), quoted, raw: input.slice(at, close + 1) })
    return close + 1
  }

  while (i < input.length) {
    const c = input[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      endWord(i)
      i++
      continue
    }
    if (c === '#' && !parts) {
      tokens.push({ kind: 'comment', text: input.slice(i), start: i, end: input.length })
      break
    }
    if (OP_CHARS.has(c)) {
      let fd: number | null = null
      let start = i
      const cur = parts as WordPart[] | null
      if (
        (c === '<' || c === '>') &&
        cur &&
        cur.length === 1 &&
        cur[0].type === 'text' &&
        cur[0].quote === 'none' &&
        /^\d$/.test(cur[0].text)
      ) {
        fd = Number(cur[0].text)
        start = wordStart
        parts = null
      } else {
        endWord(i)
      }
      const two = input.slice(i, i + 2)
      let op: OpKind
      if (TWO_CHAR_OPS.has(two)) {
        op = two as OpKind
        i += 2
      } else {
        op = c as OpKind
        i++
      }
      tokens.push({ kind: 'op', op, fd, raw: input.slice(start, i), start, end: i })
      continue
    }
    if (c === '\\') {
      if (i + 1 < input.length) {
        startWord(i)
        pushText(input[i + 1], 'escape')
        i += 2
      } else {
        pushText('\\', 'none')
        i++
      }
      continue
    }
    if (c === "'") {
      const close = input.indexOf("'", i + 1)
      if (close === -1) {
        throw new ShellSyntaxError(
          'unterminated single quote',
          "every ' needs a closing ', e.g. echo 'hello world'",
          i,
        )
      }
      startWord(i).push({ type: 'text', text: input.slice(i + 1, close), quote: 'single' })
      i = close + 1
      continue
    }
    if (c === '"') {
      const open = i
      startWord(i).push({ type: 'text', text: '', quote: 'double' })
      i++
      let closed = false
      while (i < input.length) {
        const d = input[i]
        if (d === '"') {
          closed = true
          i++
          break
        }
        if (d === '\\' && i + 1 < input.length && '$`"\\\n'.includes(input[i + 1])) {
          pushText(input[i + 1], 'double')
          i += 2
          continue
        }
        if (d === '$') {
          i = lexDollar(i, true)
          continue
        }
        if (d === '`') {
          i = lexBacktick(i, true)
          continue
        }
        pushText(d, 'double')
        i++
      }
      if (!closed) {
        throw new ShellSyntaxError('unterminated double quote', 'every " needs a closing ", e.g. echo "hi $USER"', open)
      }
      continue
    }
    if (c === '$') {
      i = lexDollar(i, false)
      continue
    }
    if (c === '`') {
      i = lexBacktick(i, false)
      continue
    }
    if (c === '~' && !parts) {
      let j = i + 1
      while (j < input.length && NAME_CHAR.test(input[j])) j++
      const after = input[j]
      if (after === undefined || after === '/' || after === ' ' || after === '\t' || OP_CHARS.has(after)) {
        startWord(i).push({ type: 'tilde', user: input.slice(i + 1, j), raw: input.slice(i, j) })
        i = j
        continue
      }
    }
    pushText(c, 'none')
    i++
  }
  endWord(i)
  return tokens
}

/** True when the word is a single unquoted literal (no quotes, no expansions). */
export function isPlainWord(word: Word): boolean {
  return word.parts.length === 1 && word.parts[0].type === 'text' && word.parts[0].quote === 'none'
}

/** The literal text of a word ignoring expansions (quotes removed). Used for heredoc delimiters and aliases. */
export function literalText(word: Word): string {
  return word.parts
    .map((p) => (p.type === 'text' ? p.text : p.raw))
    .join('')
}
