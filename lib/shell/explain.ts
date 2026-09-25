/**
 * `explain`: break a command line into annotated parts (like explainshell.com), show what it
 * expands to, and describe what it will do, without running anything.
 */
import { suggest } from './args'
import type { CommandDef } from './command'
import { expandWord, type ExpandContext } from './expand'
import { expandGlob } from './glob'
import { isPlainWord, literalText, ShellSyntaxError, type Word } from './lexer'
import { parse, type Command, type List, type Redirect, type SimpleCommand } from './parser'
import { quoteArg, type Shell } from './shell'
import { byteLength } from './vfs'

export type RowKind =
  | 'command'
  | 'alias'
  | 'option'
  | 'value'
  | 'argument'
  | 'assignment'
  | 'redirect'
  | 'operator'
  | 'subshell'
  | 'comment'

export interface ExplainRow {
  token: string
  kind: RowKind
  /** Short label shown in the middle column, e.g. 'pattern', 'file', 'pipe'. */
  label: string
  text: string
}

export interface Explanation {
  rows: ExplainRow[]
  expanded: string | null
  summary: string[]
  error: { message: string; hint: string | null } | null
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`
}

/** Expansion preview: variables and globs are live; command substitution is described, not run. */
function previewCtx(shell: Shell): ExpandContext {
  return {
    getVar: (n) => shell.getVar(n),
    setVar: () => {},
    home: shell.home,
    substitute: async (src) => `<output of ${src.trim()}>`,
    glob: (pattern) => expandGlob(pattern, shell.vfs, shell.cwd),
  }
}

async function preview(shell: Shell, word: Word, split = true): Promise<string[]> {
  try {
    return await expandWord(word, previewCtx(shell), { split, glob: split })
  } catch (e) {
    return [word.raw + (e instanceof Error ? ` (error: ${e.message})` : '')]
  }
}

/** Notes on the quoting and expansions inside one word. */
async function wordNotes(shell: Shell, word: Word): Promise<string[]> {
  const notes: string[] = []
  for (const p of word.parts) {
    if (p.type === 'text') {
      if (p.quote === 'single') notes.push(`'…' single quotes: taken literally, nothing inside expands`)
      else if (p.quote === 'escape') notes.push(`\\${p.text} backslash: this one character is taken literally`)
      else if (p.quote === 'double' && word.parts.some((q) => q.type !== 'text')) {
        // Described with the expansion itself.
      } else if (p.quote === 'double') notes.push(`"…" double quotes: keeps spaces together as one argument`)
    } else if (p.type === 'param') {
      const v = p.op === 'length' ? String([...(shell.getVar(p.name) ?? '')].length) : shell.getVar(p.name)
      const shown = v === undefined ? 'nothing (it is not set)' : `"${v}"`
      const where = p.quoted ? ' (inside double quotes, so spaces are kept)' : ''
      if (p.name === '?') notes.push(`$? is the exit code of the last command: ${shown}`)
      else if (p.op === 'length') notes.push(`\${#${p.name}} is the length of $${p.name}: ${shown}`)
      else notes.push(`${p.raw} expands to ${shown}${where}`)
    } else if (p.type === 'subst') {
      notes.push(`${p.raw} command substitution: runs \`${p.source.trim()}\` and puts its output here`)
    } else if (p.type === 'arith') {
      let v = '?'
      try {
        v = (await preview(shell, { parts: [p], raw: p.raw, start: 0, end: 0 }, false))[0]
      } catch {
        v = '?'
      }
      notes.push(`${p.raw} arithmetic: ${v}`)
    } else if (p.type === 'tilde') {
      notes.push(`~ is your home directory, ${shell.home}`)
    }
  }
  const hasGlob = word.parts.some((p) => p.type === 'text' && p.quote === 'none' && /[*?[]/.test(p.text))
  if (hasGlob) {
    const matches = await preview(shell, word)
    const raw = literalText(word)
    if (matches.length === 1 && matches[0] === raw) notes.push(`glob ${raw} matches nothing, so it is passed through unchanged`)
    else notes.push(`glob: ${raw} matches ${matches.length} ${matches.length === 1 ? 'name' : 'names'}: ${matches.slice(0, 6).join(' ')}${matches.length > 6 ? ' …' : ''}`)
  }
  return notes
}

function pathNote(shell: Shell, value: string): string {
  const abs = shell.resolve(value)
  const node = shell.vfs.stat(abs)
  if (!node) return `${shell.display(abs)} does not exist`
  if (node.type === 'dir') return `${shell.display(abs)} is a directory`
  return `${shell.display(abs)} exists (${sizeLabel(byteLength(node.content ?? ''))}${node.owner === 'guest' ? ', yours' : ''})`
}

function whereIs(shell: Shell, def: CommandDef): string {
  const dir = shell.binDir(def)
  if (!dir) return 'built into the shell'
  return dir === '/usr/local/bin' ? `Raj's tool, ${dir}/${def.name}` : `${dir}/${def.name}`
}

function redirectText(shell: Shell, r: Redirect, target: string): string {
  if (r.op === '<<') return `here-document: the lines you type next, up to ${r.heredoc?.delimiter ?? 'the delimiter'}, become the input`
  if (r.op === '>&' || r.op === '<&') {
    if (r.fd === 2 && target === '1') return 'errors (stderr) go wherever normal output (stdout) goes'
    if (r.fd === 1 && target === '2') return 'normal output goes to where errors go'
    return 'duplicates a file descriptor'
  }
  if (r.op === '<') return `input (stdin) is read from ${target} instead of the keyboard`
  const stream = r.fd === 2 ? 'error messages (stderr)' : 'output (stdout)'
  const abs = shell.resolve(target)
  const where = target === '/dev/null' ? '/dev/null, which throws them away' : target
  const perm = target !== '/dev/null' && !shell.canWritePath(abs) ? `. Careful: you can't write there (permission denied)` : ''
  return r.op === '>>'
    ? `${stream} is appended to the end of ${where}${perm}`
    : `${stream} goes to ${where}, replacing its contents (created if missing)${perm}`
}

interface Walker {
  rows: ExplainRow[]
  summary: string[]
}

async function explainSimple(shell: Shell, cmd: SimpleCommand, w: Walker, connector: string): Promise<{ name: string; expanded: string }> {
  const expandedParts: string[] = []
  for (const a of cmd.assigns) {
    const value = (await preview(shell, a.value, false))[0]
    const scope = cmd.words.length
      ? `in the environment of this one command only`
      : `as a shell variable (not exported: use export ${a.name} to pass it to programs)`
    w.rows.push({ token: a.raw, kind: 'assignment', label: 'assignment', text: `sets ${a.name} to "${value}" ${scope}` })
    expandedParts.push(`${a.name}=${quoteArg(value)}`)
  }
  let name = ''
  let def: CommandDef | undefined
  let argv: string[] = []
  if (cmd.words.length) {
    if (cmd.alias) w.rows.push({ token: cmd.alias.name, kind: 'alias', label: 'alias', text: `a shortcut for "${cmd.alias.value}"` })
    const first = cmd.words[0]
    const names = await preview(shell, first)
    name = names[0] ?? literalText(first)
    def = shell.command(name)
    const found = def ? shell.lookupCommand(name) : null
    let text: string
    if (def && found) text = `${def.summary} · ${whereIs(shell, def)}`
    else if (def) text = `${def.summary}, but ${shell.binDir(def)} is not in your PATH, so it would fail`
    else {
      const guess = suggest(name, shell.commandDefs().filter((c) => !c.hidden).map((c) => c.name))
      text = `not a command here: this would fail with "command not found"${guess ? ` (did you mean ${guess}?)` : ''}`
    }
    const notes = isPlainWord(first) ? [] : await wordNotes(shell, first)
    w.rows.push({ token: cmd.alias ? `${first.raw} (from alias)` : first.raw, kind: 'command', label: def?.kind === 'builtin' ? 'builtin' : 'command', text: [text, ...notes].join('; ') })

    let operandIndex = 0
    let valueFor: string | null = null
    for (const word of cmd.words.slice(1)) {
      const values = await preview(shell, word)
      argv.push(...values)
      const raw = word.raw
      const notes = await wordNotes(shell, word)
      if (valueFor) {
        w.rows.push({ token: raw, kind: 'value', label: 'value', text: [`the value for ${valueFor}`, ...notes].join('; ') })
        valueFor = null
        continue
      }
      const plain = isPlainWord(word) ? raw : null
      if (def && plain && plain.length > 1 && plain.startsWith('-')) {
        const flags = def.flags ?? {}
        if (flags[plain]) {
          w.rows.push({ token: raw, kind: 'option', label: 'option', text: flags[plain] })
          if (def.valueFlags?.includes(plain)) valueFor = plain
          continue
        }
        if (/^-\d+$/.test(plain) && def.valueFlags?.includes('-n')) {
          w.rows.push({ token: raw, kind: 'option', label: 'option', text: `short for -n ${plain.slice(1)}` })
          continue
        }
        if (/^-[A-Za-z0-9]{2,}$/.test(plain)) {
          const letters = plain.slice(1).split('')
          const known = letters.map((l) => (flags[`-${l}`] ? `-${l} ${flags[`-${l}`]}` : `-${l} (unknown to ${name})`))
          w.rows.push({ token: raw, kind: 'option', label: 'options', text: `${letters.length} flags in one: ${known.join(' · ')}` })
          const lastLetter = `-${letters[letters.length - 1]}`
          if (def.valueFlags?.includes(lastLetter)) valueFor = lastLetter
          continue
        }
        w.rows.push({ token: raw, kind: 'option', label: 'option', text: `an option ${name} does not recognise` })
        continue
      }
      const roles = def?.operands ?? []
      const role = roles.length ? roles[Math.min(operandIndex, roles.length - 1)] : null
      operandIndex++
      const pieces: string[] = []
      if (role) pieces.push(role.label)
      if (role && ['path', 'file', 'dir'].includes(role.kind)) {
        for (const v of values.slice(0, 3)) pieces.push(pathNote(shell, v))
      }
      pieces.push(...notes)
      if (!pieces.length) pieces.push(`an argument passed to ${name || 'the command'}`)
      w.rows.push({ token: raw, kind: 'argument', label: role?.kind === 'pattern' ? 'pattern' : role ? role.kind : 'argument', text: pieces.join('; ') })
    }
    expandedParts.push(...[name, ...argv].map(quoteArg))
  }

  const redirectSentences: string[] = []
  for (const r of cmd.redirects) {
    const target = r.op === '<<' ? (r.heredoc?.delimiter ?? '') : (await preview(shell, r.target, false))[0]
    w.rows.push({ token: r.raw, kind: 'redirect', label: 'redirect', text: redirectText(shell, r, target) })
    expandedParts.push(r.op === '<<' ? r.raw : `${r.fd !== (r.op === '<' ? 0 : 1) ? r.fd : ''}${r.op}${r.op === '>&' || r.op === '<&' ? '' : ' '}${quoteArg(target)}`)
    if ((r.op === '>' || r.op === '>>') && r.fd === 1) redirectSentences.push(`The output goes to ${target}${r.op === '>>' ? ' (appended)' : ''} instead of the screen.`)
    if (r.op === '<') redirectSentences.push(`It reads its input from ${target}.`)
    if ((r.op === '>' || r.op === '>>') && r.fd === 2) redirectSentences.push(`Error messages go to ${target}.`)
  }

  let sentence = ''
  if (def) sentence = def.describe?.(argv, shell) ?? `${name} runs: ${def.summary}.`
  else if (name) sentence = `${name} is not a known command, so this part would fail with exit code 127.`
  else if (cmd.assigns.length) sentence = `Sets ${cmd.assigns.map((a) => a.name).join(', ')} as shell variable${cmd.assigns.length > 1 ? 's' : ''}.`
  const full = [sentence, ...redirectSentences].filter(Boolean).join(' ')
  if (full) w.summary.push(connector ? `${connector} ${full.charAt(0).toLowerCase()}${full.slice(1)}` : full)
  return { name, expanded: expandedParts.join(' ') }
}

async function explainCommand(shell: Shell, c: Command, w: Walker, connector: string): Promise<{ name: string; expanded: string }> {
  if (c.type === 'simple') return explainSimple(shell, c, w, connector)
  w.rows.push({ token: '( … )', kind: 'subshell', label: 'subshell', text: "runs inside a subshell: cd and variables inside don't leak out" })
  const inner = await explainList(shell, c.body, w, connector ? `${connector} in a subshell,` : 'In a subshell,')
  return { name: '(', expanded: `( ${inner} )` }
}

async function explainList(shell: Shell, list: List, w: Walker, lead = ''): Promise<string> {
  const parts: string[] = []
  let connector = lead
  for (const item of list.items) {
    const pipelines = [{ op: null as string | null, pipeline: item.andOr.first }, ...item.andOr.rest.map((r) => ({ op: r.op as string | null, pipeline: r.pipeline }))]
    for (const { op, pipeline } of pipelines) {
      if (op) {
        w.rows.push({
          token: op,
          kind: 'operator',
          label: op === '&&' ? 'and' : 'or',
          text: op === '&&' ? 'run the next command only if the previous one succeeded (exit code 0)' : 'run the next command only if the previous one failed (non-zero exit code)',
        })
        parts.push(op)
        connector = op === '&&' ? 'If that succeeds,' : 'If that fails,'
      }
      if (pipeline.negate) {
        w.rows.push({ token: '!', kind: 'operator', label: 'not', text: 'flips the exit code: success becomes failure and vice versa' })
        parts.push('!')
      }
      const stages: string[] = []
      for (let i = 0; i < pipeline.commands.length; i++) {
        const res = await explainCommand(shell, pipeline.commands[i], w, i === 0 ? connector : 'That output is piped into')
        stages.push(res.expanded)
        if (i < pipeline.commands.length - 1) {
          const next = pipeline.commands[i + 1]
          const nextName = next.type === 'simple' && next.words[0] ? literalText(next.words[0]) : 'the next command'
          w.rows.push({ token: '|', kind: 'operator', label: 'pipe', text: `pipe: the output of ${res.name || 'this command'} becomes the input of ${nextName}` })
        }
      }
      parts.push(stages.join(' | '))
      connector = ''
    }
    if (item.sep) {
      w.rows.push({
        token: item.sep,
        kind: 'operator',
        label: item.sep === ';' ? 'then' : 'background',
        text: item.sep === ';' ? 'then run the next command, whatever happened' : 'run in the background (this terminal runs it in the foreground)',
      })
      parts.push(item.sep)
      connector = 'Then,'
    }
  }
  return parts.join(' ').replace(/ ;/g, ';')
}

export async function explainLine(shell: Shell, line: string): Promise<Explanation> {
  let parsed
  try {
    parsed = parse(line, { aliases: shell.aliases })
  } catch (e) {
    if (e instanceof ShellSyntaxError) return { rows: [], expanded: null, summary: [], error: { message: e.message, hint: e.hint } }
    throw e
  }
  const w: Walker = { rows: [], summary: [] }
  const expanded = await explainList(shell, parsed.list, w)
  if (parsed.comment) w.rows.push({ token: parsed.comment, kind: 'comment', label: 'comment', text: 'everything after # is ignored by the shell' })
  return { rows: w.rows, expanded: expanded || null, summary: w.summary, error: null }
}
