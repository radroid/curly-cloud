import { fail, outln, usage, type CommandContext, type CommandDef, type CommandGroup, type ManPage } from '../command'
import { explainLine, type ExplainRow } from '../explain'
import { runLearn, LESSONS } from '../learn'
import { TOPIC_PAGES } from '../man'
import { accent, cmd, dim, err, hi, pad, seg, strong, wrapText, writeln, type Printable } from '../output'
import type { Segment } from '../types'

const GROUPS: [CommandGroup, string][] = [
  ['files', 'Files and directories'],
  ['text', 'Reading and filtering text'],
  ['shell', 'Variables and the shell'],
  ['raj', 'Raj and his AI clone'],
  ['learn', 'Learning'],
  ['fun', 'Fun'],
]

const help: CommandDef = {
  name: 'help',
  summary: 'list every command',
  kind: 'builtin',
  group: 'learn',
  operands: [{ kind: 'command', label: 'command name' }],
  describe: (args) => (args.length ? `help shows a one-line summary of ${args[0]}.` : 'help lists every command, grouped.'),
  man: {
    synopsis: ['help [COMMAND]'],
    description: ['List every command with a one-line summary, grouped by what it is for. help COMMAND shows its usage; man COMMAND shows the full manual.'],
    seeAlso: ['man', 'learn', 'explain'],
  },
  run(ctx) {
    const shell = ctx.shell
    const name = ctx.args[0]
    if (name) {
      const def = shell.command(name)
      if (!def) return fail(ctx, `no help for '${name}'. Try: help`)
      outln(ctx, strong(def.name), dim(` — ${def.summary}`))
      for (const s of def.man.synopsis) outln(ctx, '  ', hi(s))
      outln(ctx, dim('More: '), cmd(`man ${def.name}`))
      return 0
    }
    const defs = shell.commandDefs().filter((d) => !d.hidden)
    const w = Math.max(...defs.map((d) => d.name.length)) + 2
    outln(ctx, strong('rsh'), dim(": Raj's shell. Click a command or type it; "), cmd('man <command>', 'man COMMAND'), dim(' explains one in depth.'))
    for (const [group, label] of GROUPS) {
      const inGroup = defs.filter((d) => d.group === group)
      if (!inGroup.length) continue
      outln(ctx)
      outln(ctx, hi(label))
      for (const d of inGroup) outln(ctx, '  ', cmd(d.name === 'ask' ? 'ask "what are you building now?"' : d.name, d.name), pad('', w - d.name.length), dim(d.summary))
    }
    outln(ctx)
    outln(ctx, hi('Syntax'))
    const syntax: [string, string][] = [
      ['a | b', 'pipe: output of a becomes input of b'],
      ['a > f  a >> f  a < f', 'write, append, read a file'],
      ['a && b   a || b   a; b', 'if a succeeded · if a failed · then'],
      ['$VAR  "$VAR"  \'$VAR\'', 'expand · expand, keep spaces · literal'],
      ['$(cmd)  $((1+2))  *.md', 'command output · arithmetic · glob'],
      ['!!  !N  ↑ ↓  Tab', 'history and completion'],
    ]
    const sw = Math.max(...syntax.map(([s]) => s.length)) + 2
    for (const [s, d] of syntax) outln(ctx, '  ', accent(s), pad('', sw - s.length), dim(d))
    outln(ctx)
    outln(ctx, dim('New here? '), cmd('learn'), dim(' · Confused by a line? '), cmd("explain 'ls -la | wc -l'", 'explain'), dim(' · Concepts: '), cmd('man rsh'))
    return 0
  },
}

function renderMan(ctx: CommandContext, name: string, summary: string, page: ManPage, footer: Printable[]): void {
  const title = `${name.toUpperCase()}(1)`
  const cols = Math.min(ctx.shell.columns(), 78)
  const middle = 'rsh manual'
  const gap = Math.max(2, cols - title.length * 2 - middle.length)
  outln(ctx, dim(`${title}${' '.repeat(Math.floor(gap / 2))}${middle}${' '.repeat(Math.ceil(gap / 2))}${title}`))
  const section = (label: string): void => {
    outln(ctx)
    outln(ctx, hi(label))
  }
  section('NAME')
  outln(ctx, '    ', strong(name), ` — ${summary}`)
  section('SYNOPSIS')
  for (const s of page.synopsis) outln(ctx, '    ', s)
  section('DESCRIPTION')
  page.description.forEach((p, i) => {
    if (i) outln(ctx)
    for (const line of wrapText(p, ctx.shell.columns() - 4)) outln(ctx, '    ', line)
  })
  if (page.options?.length) {
    section('OPTIONS')
    const w = Math.min(14, Math.max(...page.options.map(([o]) => o.length)) + 2)
    for (const [o, d] of page.options) outln(ctx, '    ', accent(o), o.length < w ? pad('', w - o.length) : '  ', d)
  }
  if (page.examples?.length) {
    section('EXAMPLES')
    for (const [c, d] of page.examples) outln(ctx, '    ', cmd(c), dim(`   # ${d}`))
  }
  const see = (page.seeAlso ?? []).filter((s) => ctx.shell.command(s) || TOPIC_PAGES.some((t) => t.name === s))
  if (see.length) {
    section('SEE ALSO')
    outln(ctx, '    ', see.flatMap((s, i) => [i ? dim(', ') : '', cmd(`man ${s}`, s)]))
  }
  if (footer.length) {
    outln(ctx)
    outln(ctx, footer)
  }
}

export function manTopics(ctx: CommandContext | null, shell = ctx?.shell): string[] {
  if (!shell) return TOPIC_PAGES.map((t) => t.name)
  return [...shell.commandDefs().filter((d) => !d.hidden).map((d) => d.name), ...TOPIC_PAGES.map((t) => t.name)]
}

const man: CommandDef = {
  name: 'man',
  summary: 'read the manual for a command or concept',
  kind: 'bin',
  group: 'learn',
  operands: [{ kind: 'command', label: 'command or topic' }],
  complete: (shell) => manTopics(null, shell),
  describe: (args) => `man shows the manual page for ${args[0] ?? 'a command'}.`,
  man: {
    synopsis: ['man COMMAND', 'man TOPIC'],
    description: [
      'Show the manual page for a command: what it does, its options, and examples you can click. There are also pages for concepts: rsh, quoting, variables, pipes, redirects, globs, permissions, exit-codes.',
    ],
    examples: [
      ['man grep', 'a command'],
      ['man quoting', 'a concept'],
      ['man man', 'this page'],
    ],
    seeAlso: ['help', 'explain', 'rsh'],
  },
  run(ctx) {
    const name = ctx.args[0]
    if (!name) {
      outln(ctx, 'What manual page do you want? For example:')
      outln(ctx, '  ', ['ls', 'grep', 'export', 'ask'].flatMap((c, i) => [i ? dim(' · ') : '', cmd(`man ${c}`)]))
      outln(ctx, dim('Concepts: '), TOPIC_PAGES.flatMap((t, i) => [i ? dim(' · ') : '', cmd(`man ${t.name}`, t.name)]))
      return 1
    }
    const topic = TOPIC_PAGES.find((t) => t.name === name)
    const def = ctx.shell.command(name === '.' ? 'source' : name)
    if (def && !(topic && name === 'rsh')) {
      const found = ctx.shell.lookupCommand(def.name, ctx.env.PATH)
      const where = def.kind === 'builtin' ? 'a shell builtin' : `${ctx.shell.binDir(def)}/${def.name}`
      renderMan(ctx, def.name, def.summary, def.man, [
        dim(`${def.name} is ${where}.`),
        ...(found ? [] : [dim(' (Not found in your current PATH.)')]),
        dim(' Take any line apart with '),
        cmd(`explain '${def.man.examples?.[0]?.[0]?.replace(/'/g, '') ?? def.name}'`, 'explain'),
        dim('.'),
      ])
      return 0
    }
    if (topic) {
      renderMan(ctx, topic.name, topic.summary, topic, [dim('Try it for real: '), cmd('learn')])
      return 0
    }
    return fail(ctx, `no manual entry for ${name}`, 16)
  },
}

const KIND_STYLE: Record<ExplainRow['kind'], Segment['style']> = {
  command: 'strong',
  alias: 'strong',
  option: 'accent',
  value: 'plain',
  argument: 'plain',
  assignment: 'highlight',
  redirect: 'prompt',
  operator: 'prompt',
  subshell: 'prompt',
  comment: 'dim',
}

const explain: CommandDef = {
  name: 'explain',
  summary: 'take a command line apart, piece by piece',
  kind: 'local',
  group: 'learn',
  operands: [{ kind: 'text', label: 'the command line to explain (quote it)' }],
  describe: () => 'explain annotates each piece of a command line without running it.',
  man: {
    synopsis: ["explain 'COMMAND LINE'"],
    description: [
      'Break a command line into its parts, say what each one is (command, option, argument, variable, glob, pipe, redirect…) and what it will do, then show what the line expands to. Nothing is run.',
      'Quote the line in single quotes, otherwise the shell acts on its pipes and variables before explain sees them.',
    ],
    examples: [
      ["explain 'ls -la ~'", 'options and ~'],
      ["explain 'cat *.md | grep -i agent | wc -l'", 'a pipeline'],
      ["explain 'grep -i mcp resume.md > /tmp/x'", 'a redirect'],
      ['explain \'echo "$HOME" \\$HOME\'', 'quoting'],
    ],
    seeAlso: ['man', 'rsh', 'quoting'],
  },
  async run(ctx) {
    const line = ctx.args.join(' ').trim() || (ctx.stdin?.trim() ?? '')
    if (!line) return usage(ctx, "give it a command line in single quotes, e.g. explain 'ls -la | wc -l'")
    const ex = await explainLine(ctx.shell, line)
    outln(ctx, '  ', strong(line))
    outln(ctx)
    if (ex.error) {
      writeln(ctx.stderr, err(`  syntax error: ${ex.error.message.replace(/^syntax error:?\s*/, '')}`))
      if (ex.error.hint) writeln(ctx.stderr, dim(`  ${ex.error.hint}`))
      return 1
    }
    const narrow = ctx.shell.columns() < 72
    const tw = Math.min(22, Math.max(...ex.rows.map((r) => [...r.token].length)) + 2)
    const lw = Math.max(...ex.rows.map((r) => r.label.length)) + 2
    const cols = ctx.shell.columns()
    // Continuation lines hang under the text column instead of wrapping back to the margin.
    const hanging = (text: string, indent: number): string[] => {
      const [first, ...rest] = wrapText(text, cols - indent)
      return [first, ...rest.map((l) => '\n' + ' '.repeat(indent) + l)]
    }
    for (const r of ex.rows) {
      const token = seg(r.token, KIND_STYLE[r.kind])
      if (narrow) {
        outln(ctx, '  ', token, dim(`  ${r.label}`))
        outln(ctx, '      ', hanging(r.text, 6))
      } else {
        const tlen = [...r.token].length
        outln(ctx, '  ', token, tlen < tw ? pad('', tw - tlen) : '  ', dim(pad(r.label, lw)), hanging(r.text, 2 + Math.max(tw, tlen + 2) + lw))
      }
    }
    outln(ctx)
    const labelWidth = narrow ? 12 : tw + lw
    if (ex.expanded) outln(ctx, '  ', dim(pad('expands to', labelWidth)), accent(ex.expanded))
    if (ex.summary.length) outln(ctx, '  ', dim(pad('in words', labelWidth)), hanging(ex.summary.join(' '), 2 + labelWidth))
    return 0
  },
}

const learn: CommandDef = {
  name: 'learn',
  summary: 'a hands-on tutorial in 7 short lessons',
  kind: 'local',
  group: 'learn',
  operands: [{ kind: 'text', label: 'next, a lesson number, stop or reset' }],
  complete: () => ['next', 'stop', 'reset', ...LESSONS.map((_, i) => String(i + 1))],
  describe: (args) => (args[0] === 'reset' ? 'learn reset clears your tutorial progress.' : 'learn runs the interactive shell tutorial.'),
  man: {
    synopsis: ['learn', 'learn next', 'learn N', 'learn stop', 'learn reset'],
    description: [
      `A guided tutorial in ${LESSONS.length} lessons: ${LESSONS.map((l) => l.title.toLowerCase()).join(', ')}. Each step gives you a goal; type the command and the lesson checks what actually happened.`,
      'learn shows your progress (or starts lesson 1). learn next skips a step, or starts the next lesson. learn N jumps to lesson N. Progress is saved in this browser.',
    ],
    examples: [
      ['learn', 'start, or see progress'],
      ['learn 5', 'jump to pipes and redirects'],
    ],
    seeAlso: ['help', 'man', 'explain'],
  },
  run(ctx) {
    return runLearn(ctx.shell, ctx.args, ctx.stdout)
  },
}

export const TEACH_COMMANDS: CommandDef[] = [help, man, explain, learn]
