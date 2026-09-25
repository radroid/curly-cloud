import { parseArgs } from '../args'
import { fail, fsFail, out, outln, readInputs, splitLines, usage, type CommandDef } from '../command'
import { dim, padStart, seg } from '../output'
import type { Segment } from '../types'
import { byteLength, FsError } from '../vfs'
import { pathSegment, styleFileLine } from './files'

function interpretEscapes(s: string): string {
  return s.replace(/\\([nt\\abe0]|c)/g, (_, c: string) => ({ n: '\n', t: '\t', '\\': '\\', a: '', b: '', e: '', '0': '', c: '' })[c] ?? c)
}

const echo: CommandDef = {
  name: 'echo',
  summary: 'print its arguments',
  kind: 'builtin',
  group: 'text',
  flags: { '-n': 'no newline at the end', '-e': 'interpret \\n and \\t escapes' },
  operands: [{ kind: 'text', label: 'text to print' }],
  describe: (args) => {
    const text = args.filter((a, i) => !(i === 0 && /^-[neE]+$/.test(a))).join(' ')
    return `echo prints "${text}"${args[0] === '-n' ? ' without a trailing newline' : ''}.`
  },
  man: {
    synopsis: ['echo [-n] [-e] [TEXT...]'],
    description: [
      'Print the arguments separated by single spaces, then a newline. The shell has already expanded variables, globs and quotes before echo sees anything, which makes echo the best way to see what the shell does to a line.',
    ],
    options: [
      ['-n', 'do not print the trailing newline'],
      ['-e', 'turn \\n into a newline and \\t into a tab'],
    ],
    examples: [
      ['echo hello', 'the simplest program'],
      ['echo "I am $USER"', 'double quotes: variables expand'],
      ["echo 'I am $USER'", 'single quotes: literal'],
      ['echo *.md', 'globs expand to file names'],
      ['echo $((6 * 7))', 'arithmetic'],
    ],
    seeAlso: ['printenv', 'explain'],
  },
  run(ctx) {
    let args = ctx.args
    let newline = true
    let escapes = false
    while (args.length && /^-[neE]+$/.test(args[0])) {
      if (args[0].includes('n')) newline = false
      if (args[0].includes('e')) escapes = true
      if (args[0].includes('E')) escapes = false
      args = args.slice(1)
    }
    let text = args.join(' ')
    if (escapes) text = interpretEscapes(text)
    out(ctx, text + (newline ? '\n' : ''))
    return 0
  },
}

function headTail(which: 'head' | 'tail'): CommandDef {
  const isHead = which === 'head'
  return {
    name: which,
    summary: isHead ? 'print the first lines of a file' : 'print the last lines of a file',
    kind: 'bin',
    group: 'text',
    flags: { '-n': isHead ? 'how many lines from the top (default 10)' : 'how many lines from the end (default 10; +N starts at line N)' },
    valueFlags: ['-n'],
    operands: [{ kind: 'file', label: 'file to read' }],
    describe: (args) => {
      const i = args.indexOf('-n')
      const n = i >= 0 ? args[i + 1] : (args.find((a) => /^-\d+$/.test(a))?.slice(1) ?? '10')
      const files = args.filter((a, idx) => !a.startsWith('-') && args[idx - 1] !== '-n')
      return `${which} prints the ${isHead ? 'first' : 'last'} ${n} lines of ${files.join(', ') || 'its input'}.`
    },
    man: {
      synopsis: [`${which} [-n N] [FILE...]`],
      description: [
        isHead
          ? 'Print the first 10 lines of each file, or of its input. Handy for peeking at a long file, or for keeping only the top of a sorted list.'
          : 'Print the last 10 lines of each file, or of its input. -n +N prints from line N to the end instead.',
      ],
      options: [['-n N', `print ${N(isHead)} N lines (also written -N)`]],
      examples: isHead
        ? [
            ['head -n 5 resume.md', 'the top of the resume'],
            ['sort skills/*.txt | head -3', 'the first three after sorting'],
          ]
        : [
            ['tail -n 3 about.txt', 'the end of a file'],
            ['history | tail', 'your last ten commands'],
          ],
      seeAlso: [isHead ? 'tail' : 'head', 'cat', 'wc'],
    },
    run(ctx) {
      const a = parseArgs(ctx.args, { value: 'nc', numeric: 'n', bool: 'qv' })
      if (a.error) return usage(ctx, a.error)
      const raw = a.values.get('n') ?? '10'
      const fromStart = !isHead && raw.startsWith('+')
      const n = Number(raw.replace(/^[+-]/, ''))
      if (!Number.isInteger(n) || n < 0) return usage(ctx, `invalid number of lines: '${raw}'`)
      const multi = a.operands.length > 1
      let first = true
      return readInputs(ctx, a.operands, (text, name) => {
        if (multi) {
          if (!first) outln(ctx)
          outln(ctx, dim(`==> ${name ?? 'standard input'} <==`))
        }
        first = false
        const lines = splitLines(text)
        const picked = isHead ? lines.slice(0, n) : fromStart ? lines.slice(Math.max(0, n - 1)) : n === 0 ? [] : lines.slice(-n)
        for (const line of picked) outln(ctx, styleFileLine(line, name, ctx.isTTY))
      })
    },
  }
}

function N(isHead: boolean): string {
  return isHead ? 'the first' : 'the last'
}

const wc: CommandDef = {
  name: 'wc',
  summary: 'count lines, words and bytes',
  kind: 'bin',
  group: 'text',
  flags: { '-l': 'count lines', '-w': 'count words', '-c': 'count bytes', '-m': 'count characters' },
  operands: [{ kind: 'file', label: 'file to count' }],
  describe: (args) => {
    const what = args.some((a) => /^-\w*l/.test(a)) ? 'lines' : args.some((a) => /^-\w*w/.test(a)) ? 'words' : 'lines, words and bytes'
    const files = args.filter((a) => !a.startsWith('-'))
    return `wc counts the ${what} in ${files.join(', ') || 'its input'}.`
  },
  man: {
    synopsis: ['wc [-lwcm] [FILE...]'],
    description: [
      'Count lines, words and bytes in each file, or in its input. At the end of a pipe, wc -l answers "how many?": how many matches, how many files.',
    ],
    options: [
      ['-l', 'lines'],
      ['-w', 'words (runs of non-space characters)'],
      ['-c', 'bytes'],
      ['-m', 'characters'],
    ],
    examples: [
      ['wc about.txt', 'lines, words, bytes'],
      ['ls experience | wc -l', 'how many roles'],
      ['grep -i mcp resume.md | wc -l', 'how many lines mention MCP'],
    ],
    seeAlso: ['grep', 'sort', 'uniq'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'lwcm' })
    if (a.error) return usage(ctx, a.error)
    let keys = (['l', 'w', 'm', 'c'] as const).filter((k) => a.flags.has(k))
    if (!keys.length) keys = ['l', 'w', 'c']
    const rows: { counts: number[]; name: string | null }[] = []
    const status = readInputs(ctx, a.operands, (text, name) => {
      const counts = keys.map((k) =>
        k === 'l' ? (text.match(/\n/g) ?? []).length : k === 'w' ? text.split(/\s+/).filter(Boolean).length : k === 'm' ? [...text].length : byteLength(text),
      )
      rows.push({ counts, name })
    })
    if (rows.length > 1) rows.push({ counts: keys.map((_, i) => rows.reduce((s, r) => s + r.counts[i], 0)), name: 'total' })
    const stdinOnly = rows.every((r) => r.name === null)
    const maxDigits = Math.max(1, ...rows.flatMap((r) => r.counts.map((c) => String(c).length)))
    const width = stdinOnly ? (keys.length === 1 ? 0 : Math.max(7, maxDigits)) : maxDigits
    for (const r of rows) {
      const nums = r.counts.map((c) => padStart(String(c), width)).join(' ')
      outln(ctx, nums + (r.name ? ` ${r.name}` : ''))
    }
    return status
  },
}

/** Compile a grep pattern. Basic regex extras: \| for alternation. */
function compilePattern(pattern: string, opts: { fixed: boolean; ignoreCase: boolean; word: boolean }): RegExp | null {
  let src = opts.fixed ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern.replace(/\\\|/g, '|')
  if (opts.word) src = `\\b(?:${src})\\b`
  try {
    return new RegExp(src, opts.ignoreCase ? 'gi' : 'g')
  } catch {
    return null
  }
}

function highlightMatches(line: string, re: RegExp, base: Segment[]): Segment[] {
  const out: Segment[] = []
  let last = 0
  re.lastIndex = 0
  for (const m of line.matchAll(re)) {
    if (!m[0]) continue
    if (m.index! > last) out.push(seg(line.slice(last, m.index)))
    out.push(seg(m[0], 'highlight'))
    last = m.index! + m[0].length
  }
  if (last < line.length) out.push(seg(line.slice(last)))
  return out.length ? out : base
}

const grep: CommandDef = {
  name: 'grep',
  summary: 'print lines that match a pattern',
  kind: 'bin',
  group: 'text',
  flags: {
    '-i': 'ignore case (MCP matches mcp)',
    '-n': 'show line numbers',
    '-v': 'invert: print lines that do NOT match',
    '-c': 'print only a count of matching lines',
    '-l': 'print only the names of files that match',
    '-r': 'search directories recursively',
    '-w': 'match whole words only',
    '-o': 'print only the matching part',
    '-E': 'extended regular expressions (the default here)',
    '-F': 'fixed string: no regex, match literally',
    '-q': 'quiet: print nothing, just set the exit code',
  },
  operands: [
    { kind: 'pattern', label: 'the pattern to search for' },
    { kind: 'file', label: 'file to search' },
  ],
  describe: (args) => {
    const flags = args.filter((a) => /^-\w+$/.test(a)).join('')
    const ops = args.filter((a) => !/^-\w+$/.test(a))
    const [pattern, ...files] = ops
    const parts = [`grep ${flags.includes('c') ? 'counts' : 'prints'} the lines of ${files.join(', ') || 'its input'} that ${flags.includes('v') ? "don't " : ''}match "${pattern ?? ''}"`]
    if (flags.includes('i')) parts.push('ignoring case')
    if (flags.includes('r')) parts.push('searching directories recursively')
    return parts.join(', ') + '.'
  },
  man: {
    synopsis: ['grep [-invclrwoEFq] PATTERN [FILE...]'],
    description: [
      'Search files (or its input) for lines that match PATTERN, and print them. The pattern is a regular expression: . matches any character, ^ and $ anchor the start and end of a line, a|b matches either.',
      'Exit code: 0 if something matched, 1 if nothing did, 2 on an error. That makes grep useful with && and ||.',
    ],
    options: [
      ['-i', 'ignore case'],
      ['-n', 'prefix each line with its line number'],
      ['-v', 'print the lines that do not match'],
      ['-c', 'print how many lines matched'],
      ['-l', 'print only the names of matching files'],
      ['-r', 'search directories recursively'],
      ['-w', 'match whole words only'],
      ['-o', 'print only the matched text'],
      ['-F', 'treat PATTERN as a plain string'],
      ['-q', 'print nothing; only the exit code matters'],
    ],
    examples: [
      ['grep -i mcp resume.md', 'lines mentioning MCP'],
      ['grep -rn rag ~', 'search everything, with line numbers'],
      ['cat *.md | grep -i agent | wc -l', 'count matches in a pipeline'],
      ['grep -qi kafka resume.md && echo yes', 'use the exit code'],
    ],
    seeAlso: ['find', 'wc', 'sort'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'invclrRwoEFqsH' })
    if (a.error) return usage(ctx, a.error)
    const [pattern, ...operands] = a.operands
    if (pattern === undefined) return usage(ctx, 'missing pattern (e.g. grep -i mcp resume.md)')
    const re = compilePattern(pattern, { fixed: a.flags.has('F'), ignoreCase: a.flags.has('i'), word: a.flags.has('w') })
    if (!re) return fail(ctx, `invalid regular expression: ${pattern}`, 2)
    const recursive = a.flags.has('r') || a.flags.has('R')
    const vfs = ctx.shell.vfs
    let error = false
    const inputs: { name: string | null; text: string }[] = []
    const ops = operands.length ? operands : recursive && ctx.stdin === null ? ['.'] : []
    if (!ops.length) {
      if (ctx.stdin === null) {
        readInputs(ctx, [], () => {})
        return 2
      }
      inputs.push({ name: null, text: ctx.stdin })
    }
    for (const op of ops) {
      const abs = ctx.shell.resolve(op)
      let node
      try {
        node = vfs.lookup(abs)
      } catch (e) {
        fsFail(ctx, op, e)
        error = true
        continue
      }
      if (node.type === 'dir') {
        if (!recursive) {
          fail(ctx, `${op}: Is a directory`)
          error = true
          continue
        }
        for (const p of vfs.walk(abs)) {
          const n = vfs.stat(p)
          if (!n || n.type !== 'file' || p.startsWith('/bin/') || p.startsWith('/usr/local/bin/') || p === '/dev/null') continue
          const shown = p === abs ? op : `${op.replace(/\/$/, '')}/${p.slice(abs === '/' ? 1 : abs.length + 1)}`
          try {
            inputs.push({ name: shown, text: vfs.read(p) })
          } catch (e) {
            if (e instanceof FsError && e.code === 'EACCES') continue
            throw e
          }
        }
        continue
      }
      try {
        inputs.push({ name: op, text: vfs.read(abs) })
      } catch (e) {
        fsFail(ctx, op, e)
        error = true
      }
    }
    const showName = a.flags.has('H') || inputs.length > 1 || recursive
    let matched = false
    for (const input of inputs) {
      const lines = splitLines(input.text)
      let count = 0
      const namePart = (): Segment[] =>
        showName && input.name ? [pathSegment(ctx, input.name, vfs.stat(ctx.shell.resolve(input.name)) ?? null), dim(':')] : []
      for (let i = 0; i < lines.length; i++) {
        re.lastIndex = 0
        const hit = re.test(lines[i]) !== a.flags.has('v')
        if (!hit) continue
        count++
        matched = true
        if (a.flags.has('q') || a.flags.has('c') || a.flags.has('l')) continue
        const lineNo = a.flags.has('n') ? [dim(`${i + 1}:`)] : []
        if (a.flags.has('o') && !a.flags.has('v')) {
          re.lastIndex = 0
          for (const m of lines[i].matchAll(re)) if (m[0]) outln(ctx, namePart(), lineNo, seg(m[0], ctx.isTTY ? 'highlight' : undefined))
          continue
        }
        const body = ctx.isTTY && !a.flags.has('v') ? highlightMatches(lines[i], re, [seg(lines[i])]) : [seg(lines[i])]
        outln(ctx, namePart(), lineNo, body)
      }
      if (a.flags.has('q')) continue
      if (a.flags.has('c')) outln(ctx, namePart(), String(count))
      else if (a.flags.has('l') && count && input.name) outln(ctx, pathSegment(ctx, input.name, vfs.stat(ctx.shell.resolve(input.name)) ?? null))
    }
    if (error && !(a.flags.has('q') && matched)) return 2
    return matched ? 0 : 1
  },
}

const sort: CommandDef = {
  name: 'sort',
  summary: 'sort lines',
  kind: 'bin',
  group: 'text',
  flags: { '-r': 'reverse the order', '-n': 'numeric: 10 comes after 9', '-u': 'unique: drop duplicate lines', '-f': 'ignore case' },
  operands: [{ kind: 'file', label: 'file to sort' }],
  describe: (args) => `sort puts the lines of ${args.filter((a) => !a.startsWith('-')).join(', ') || 'its input'} in ${args.some((a) => /^-\w*n/.test(a)) ? 'numeric' : 'alphabetical'}${args.some((a) => /^-\w*r/.test(a)) ? ', reversed,' : ''} order.`,
  man: {
    synopsis: ['sort [-rnuf] [FILE...]'],
    description: ['Sort lines alphabetically (or numerically with -n) and print them. Often followed by uniq, which only removes duplicates that sit next to each other.'],
    options: [
      ['-r', 'reverse'],
      ['-n', 'compare as numbers'],
      ['-u', 'output each distinct line once'],
      ['-f', 'ignore case'],
    ],
    examples: [
      ['sort skills/code.txt', 'alphabetical'],
      ['cat skills/*.txt | sort | uniq -c | sort -rn | head', 'the classic frequency count'],
    ],
    seeAlso: ['uniq', 'head', 'wc'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'rnufb' })
    if (a.error) return usage(ctx, a.error)
    const lines: string[] = []
    const status = readInputs(ctx, a.operands, (text) => lines.push(...splitLines(text)))
    const num = (s: string): number => {
      const m = /^\s*(-?\d+(?:\.\d+)?)/.exec(s)
      return m ? Number(m[1]) : 0
    }
    lines.sort((x, y) => {
      if (a.flags.has('n')) {
        const d = num(x) - num(y)
        if (d) return d
      }
      return x.localeCompare(y, 'en', { sensitivity: a.flags.has('f') ? 'base' : 'variant' })
    })
    if (a.flags.has('r')) lines.reverse()
    const outLines = a.flags.has('u') ? lines.filter((l, i) => i === 0 || l !== lines[i - 1]) : lines
    for (const l of outLines) outln(ctx, l)
    return status
  },
}

const uniq: CommandDef = {
  name: 'uniq',
  summary: 'drop repeated adjacent lines',
  kind: 'bin',
  group: 'text',
  flags: { '-c': 'prefix each line with how many times it repeated', '-d': 'only print duplicated lines', '-u': 'only print lines that never repeat', '-i': 'ignore case' },
  operands: [{ kind: 'file', label: 'file to read' }],
  describe: (args) => `uniq collapses runs of identical adjacent lines${args.some((a) => /^-\w*c/.test(a)) ? ' and counts them' : ''}. Sort first to catch every duplicate.`,
  man: {
    synopsis: ['uniq [-cdui] [FILE]'],
    description: ['Collapse runs of identical adjacent lines into one. Duplicates that are not next to each other survive, which is why uniq usually comes after sort.'],
    options: [
      ['-c', 'prefix lines with their count'],
      ['-d', 'only lines that repeat'],
      ['-u', 'only lines that do not repeat'],
      ['-i', 'ignore case when comparing'],
    ],
    examples: [['cat skills/*.txt | sort | uniq -c', 'count each distinct line']],
    seeAlso: ['sort', 'wc'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'cdui' })
    if (a.error) return usage(ctx, a.error)
    const lines: string[] = []
    const status = readInputs(ctx, a.operands.slice(0, 1), (text) => lines.push(...splitLines(text)))
    const same = (x: string, y: string): boolean => (a.flags.has('i') ? x.toLowerCase() === y.toLowerCase() : x === y)
    const groups: { line: string; count: number }[] = []
    for (const l of lines) {
      const last = groups[groups.length - 1]
      if (last && same(last.line, l)) last.count++
      else groups.push({ line: l, count: 1 })
    }
    for (const g of groups) {
      if (a.flags.has('d') && g.count < 2) continue
      if (a.flags.has('u') && g.count > 1) continue
      outln(ctx, a.flags.has('c') ? `${padStart(String(g.count), 7)} ${g.line}` : g.line)
    }
    return status
  },
}

const seq: CommandDef = {
  name: 'seq',
  summary: 'print a sequence of numbers',
  kind: 'bin',
  group: 'text',
  operands: [{ kind: 'number', label: 'number' }],
  describe: (args) => `seq prints the numbers ${args.length === 1 ? `1 to ${args[0]}` : `${args[0]} to ${args[args.length - 1]}`}, one per line.`,
  man: {
    synopsis: ['seq LAST', 'seq FIRST LAST', 'seq FIRST STEP LAST'],
    description: ['Print numbers from FIRST (default 1) to LAST, one per line. Useful for feeding pipes.'],
    examples: [
      ['seq 5', '1 to 5'],
      ['seq 10 | sort -rn | head -3', 'play with a pipeline'],
    ],
    seeAlso: ['sort', 'head'],
  },
  run(ctx) {
    const nums = ctx.args.map(Number)
    if (!nums.length || nums.length > 3 || nums.some((n) => !Number.isFinite(n))) return usage(ctx, 'expected 1 to 3 numbers')
    const [first, step, last] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums
    if (step === 0) return usage(ctx, 'step must not be zero')
    const outLines: string[] = []
    for (let n = first; step > 0 ? n <= last : n >= last; n += step) {
      outLines.push(String(n))
      if (outLines.length > 10000) break
    }
    if (outLines.length) out(ctx, outLines.join('\n') + '\n')
    return 0
  },
}

const tee: CommandDef = {
  name: 'tee',
  summary: 'copy input to the screen and to files',
  kind: 'bin',
  group: 'text',
  flags: { '-a': 'append to the files instead of overwriting' },
  operands: [{ kind: 'path', label: 'file to write' }],
  describe: (args) => `tee passes its input through to the output and also saves a copy to ${args.filter((a) => !a.startsWith('-')).join(', ') || 'files'}.`,
  man: {
    synopsis: ['tee [-a] FILE...'],
    description: ['Copy input to the output and to each FILE, like a T-junction in a pipe. See the data and save it at the same time.'],
    options: [['-a', 'append instead of overwrite']],
    examples: [['grep -i rag resume.md | tee /tmp/rag.txt | wc -l', 'save matches and count them']],
    seeAlso: ['cat'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'ai' })
    if (a.error) return usage(ctx, a.error)
    const text = ctx.stdin ?? ''
    let status = 0
    for (const f of a.operands) {
      try {
        ctx.shell.vfs.write(ctx.shell.resolve(f), text, { append: a.flags.has('a') })
      } catch (e) {
        status = fsFail(ctx, f, e)
      }
    }
    out(ctx, text)
    return status
  },
}

export const TEXT_COMMANDS: CommandDef[] = [echo, headTail('head'), headTail('tail'), wc, grep, sort, uniq, seq, tee]
