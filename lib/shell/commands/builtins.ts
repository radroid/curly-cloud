import { parseArgs } from '../args'
import { fail, ioOf, outln, usage, type CommandContext, type CommandDef } from '../command'
import { HOSTNAME } from '../fs-content'
import { cmd, dim, err, padStart, seg, writeln } from '../output'
import { quoteArg } from '../shell'

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/** `NAME='value'` as bash's `set` prints it. */
function shellAssignment(name: string, value: string): string {
  return `${name}=${quoteArg(value)}`
}

function printVars(ctx: CommandContext, vars: Record<string, string>, format: (k: string, v: string) => string): void {
  for (const k of Object.keys(vars).sort()) outln(ctx, format(k, vars[k]))
}

const env: CommandDef = {
  name: 'env',
  summary: 'print exported variables (or run a command with extra ones)',
  kind: 'bin',
  group: 'shell',
  operands: [{ kind: 'assignment', label: 'NAME=value to add' }],
  describe: (args) =>
    args.length
      ? `env runs ${args.find((a) => !a.includes('=')) ?? 'nothing'} with ${args.filter((a) => a.includes('=')).join(' ')} added to its environment.`
      : 'env prints the environment: only exported variables, the ones programs inherit.',
  man: {
    synopsis: ['env', 'env NAME=VALUE... COMMAND [ARG...]'],
    description: [
      'With no arguments, print the environment: the exported variables that every program you start inherits. Plain shell variables (set without export) are not in it; compare with set.',
      'With NAME=VALUE arguments and a command, run the command with those variables added, just for that run.',
    ],
    examples: [
      ['env', 'the environment'],
      ['env | grep RAJ', 'just the RAJ_ ones'],
      ['env GREETING=hi printenv GREETING', 'a one-off variable'],
    ],
    seeAlso: ['printenv', 'set', 'export'],
  },
  async run(ctx) {
    const extra: [string, string][] = []
    let i = 0
    for (; i < ctx.args.length; i++) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(ctx.args[i])
      if (!m) break
      extra.push([m[1], m[2]])
    }
    if (i < ctx.args.length) return ctx.shell.execArgv(ctx.args.slice(i), [...Object.entries(ctx.env), ...extra], ioOf(ctx))
    printVars(ctx, { ...ctx.env, ...Object.fromEntries(extra) }, (k, v) => `${k}=${v}`)
    return 0
  },
}

const printenv: CommandDef = {
  name: 'printenv',
  summary: 'print environment variables',
  kind: 'bin',
  group: 'shell',
  operands: [{ kind: 'name', label: 'variable name (no $)' }],
  describe: (args) => (args.length ? `printenv prints the value of ${args.join(', ')} if it is exported.` : 'printenv prints every exported variable.'),
  man: {
    synopsis: ['printenv [NAME...]'],
    description: [
      'Print the values of the named environment variables, or all of them. Only exported variables count: a shell variable you set without export is invisible here, and printenv exits 1.',
    ],
    examples: [
      ['printenv HOME', 'one value'],
      ['printenv RAJ_EMAIL', "from Raj's .profile"],
    ],
    seeAlso: ['env', 'export', 'echo'],
  },
  run(ctx) {
    if (!ctx.args.length) {
      printVars(ctx, ctx.env, (k, v) => `${k}=${v}`)
      return 0
    }
    let status = 0
    for (const name of ctx.args) {
      if (name in ctx.env) outln(ctx, ctx.env[name])
      else status = 1
    }
    return status
  },
}

const set: CommandDef = {
  name: 'set',
  summary: 'print every variable, exported or not',
  kind: 'builtin',
  group: 'shell',
  describe: () => 'set prints every variable the shell knows: exported ones and plain shell variables.',
  man: {
    synopsis: ['set'],
    description: [
      'Print every variable: the exported environment plus plain shell variables such as PS1 and RAJ_MOTTO. This is the easiest way to see the difference between the two kinds.',
      'On screen, exported names are highlighted and shell-only names are shown in sun yellow.',
    ],
    examples: [
      ['set', 'everything'],
      ['set | grep RAJ', 'including RAJ_MOTTO, which env does not show'],
    ],
    seeAlso: ['env', 'export', 'unset'],
  },
  run(ctx) {
    const all = ctx.shell.allVars()
    for (const k of Object.keys(all).sort()) {
      const value = all[k]
      if (ctx.isTTY) outln(ctx, seg(k, ctx.shell.isExported(k) ? 'accent' : 'highlight'), `=${quoteArg(value)}`)
      else outln(ctx, shellAssignment(k, value))
    }
    if (ctx.isTTY) {
      outln(ctx)
      outln(ctx, dim('Colours: '), seg('exported', 'accent'), dim(' (in env, inherited by programs) · '), seg('shell only', 'highlight'), dim(' (this shell only). Compare: '), cmd('env'))
    }
    return 0
  },
}

const exportCmd: CommandDef = {
  name: 'export',
  summary: 'put a variable in the environment',
  kind: 'builtin',
  group: 'shell',
  flags: { '-n': 'un-export: keep the variable, remove it from the environment', '-p': 'list exported variables' },
  operands: [{ kind: 'assignment', label: 'NAME or NAME=value' }],
  describe: (args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    if (!ops.length) return 'export with no names lists every exported variable.'
    if (args.includes('-n')) return `export -n takes ${ops.join(', ')} out of the environment (it stays a shell variable).`
    return `export marks ${ops.map((o) => o.split('=')[0]).join(', ')} for the environment, so every program started from now on inherits ${ops.length > 1 ? 'them' : 'it'}.`
  },
  man: {
    synopsis: ['export NAME[=VALUE]...', 'export -n NAME', 'export -p'],
    description: [
      'Mark variables for export. A plain assignment (NAME=value) creates a shell variable that only this shell sees. export puts it in the environment, which is copied into every program the shell starts.',
      'In this terminal, exported variables are also saved in your browser and come back next visit, a bit like adding them to ~/.profile.',
    ],
    options: [
      ['-n', 'remove from the environment, keep as a shell variable'],
      ['-p', 'list exported variables'],
    ],
    examples: [
      ['export COLOR=green', 'set and export in one step'],
      ['NAME=raj; export NAME', 'export an existing variable'],
      ['env | grep COLOR', 'check it is in the environment'],
    ],
    seeAlso: ['env', 'set', 'unset', 'printenv'],
  },
  run(ctx) {
    let unexport = false
    const names: string[] = []
    for (const a of ctx.args) {
      if (a === '-n') unexport = true
      else if (a === '-p') continue
      else if (a.startsWith('-')) return usage(ctx, `${a}: invalid option`)
      else names.push(a)
    }
    if (!names.length) {
      const vars = ctx.shell.exportedVars()
      for (const k of Object.keys(vars).sort()) outln(ctx, `declare -x ${k}="${vars[k].replace(/(["\\$`])/g, '\\$1')}"`)
      return 0
    }
    let status = 0
    for (const a of names) {
      const eq = a.indexOf('=')
      const name = eq === -1 ? a : a.slice(0, eq)
      if (!NAME_RE.test(name)) {
        status = fail(ctx, `\`${a}': not a valid identifier`)
        continue
      }
      if (unexport) {
        const v = ctx.shell.getVar(name)
        ctx.shell.unsetVar(name)
        if (v !== undefined) ctx.shell.setVar(name, v)
      } else ctx.shell.exportVar(name, eq === -1 ? undefined : a.slice(eq + 1))
    }
    return status
  },
}

const unset: CommandDef = {
  name: 'unset',
  summary: 'remove variables',
  kind: 'builtin',
  group: 'shell',
  operands: [{ kind: 'name', label: 'variable name (no $)' }],
  describe: (args) => `unset deletes the variable${args.length > 1 ? 's' : ''} ${args.filter((a) => !a.startsWith('-')).join(', ')}.`,
  man: {
    synopsis: ['unset NAME...'],
    description: ['Delete variables, exported or not. Careful with PATH: without it the shell cannot find programs like ls. (reset brings everything back.)'],
    examples: [['unset COLOR', 'remove a variable']],
    seeAlso: ['export', 'set'],
  },
  run(ctx) {
    let status = 0
    for (const name of ctx.args) {
      if (name === '-v' || name === '-f') continue
      if (!NAME_RE.test(name)) {
        status = fail(ctx, `\`${name}': not a valid identifier`)
        continue
      }
      ctx.shell.unsetVar(name)
    }
    return status
  },
}

const alias: CommandDef = {
  name: 'alias',
  summary: 'define or list command shortcuts',
  kind: 'builtin',
  group: 'shell',
  operands: [{ kind: 'assignment', label: "NAME='command'" }],
  describe: (args) => (args.length ? `alias makes ${args.map((a) => a.split('=')[0]).join(', ')} a shortcut for a longer command.` : 'alias lists every shortcut.'),
  man: {
    synopsis: ['alias', "alias NAME='COMMAND'", 'alias NAME'],
    description: [
      'Define a shortcut: when NAME is typed as a command, the shell swaps in COMMAND first. Quote the value so its spaces survive. With no arguments, list all aliases.',
    ],
    examples: [
      ['alias', "list them (ll comes from Raj's .profile)"],
      ["alias gs='grep -rni'", 'make your own'],
      ['type ll', 'see what an alias expands to'],
    ],
    seeAlso: ['unalias', 'type'],
  },
  run(ctx) {
    const show = (k: string): void => outln(ctx, `alias ${k}='${ctx.shell.aliases.get(k)!.replace(/'/g, `'\\''`)}'`)
    if (!ctx.args.length) {
      for (const k of [...ctx.shell.aliases.keys()].sort()) show(k)
      return 0
    }
    let status = 0
    for (const a of ctx.args) {
      const eq = a.indexOf('=')
      if (eq === -1) {
        if (ctx.shell.aliases.has(a)) show(a)
        else status = fail(ctx, `${a}: not found`)
        continue
      }
      const name = a.slice(0, eq)
      if (!name || /[\s/$`'"=|&;()<>]/.test(name)) {
        status = fail(ctx, `\`${name}': invalid alias name`)
        continue
      }
      ctx.shell.aliases.set(name, a.slice(eq + 1))
    }
    return status
  },
}

const unalias: CommandDef = {
  name: 'unalias',
  summary: 'remove command shortcuts',
  kind: 'builtin',
  group: 'shell',
  operands: [{ kind: 'name', label: 'alias name' }],
  man: {
    synopsis: ['unalias NAME...', 'unalias -a'],
    description: ['Remove aliases. -a removes all of them.'],
    examples: [['unalias ll', 'll stops working until you reset']],
    seeAlso: ['alias'],
  },
  run(ctx) {
    if (ctx.args[0] === '-a') {
      ctx.shell.aliases.clear()
      return 0
    }
    if (!ctx.args.length) return usage(ctx, 'usage: unalias NAME...')
    let status = 0
    for (const a of ctx.args) if (!ctx.shell.aliases.delete(a)) status = fail(ctx, `${a}: not found`)
    return status
  },
}

const history: CommandDef = {
  name: 'history',
  summary: 'list the commands you have typed',
  kind: 'builtin',
  group: 'shell',
  flags: { '-c': 'clear the history' },
  operands: [{ kind: 'number', label: 'how many recent entries' }],
  describe: () => 'history lists the commands you have typed, numbered. !! reruns the last one, !N reruns number N.',
  man: {
    synopsis: ['history [N]', 'history -c'],
    description: [
      'List previous commands with their numbers. Re-run them without retyping: !! is the last command, !N is command number N, !-2 is the one before last, !cat is the most recent starting with cat. The ↑ and ↓ keys walk through the same list.',
    ],
    options: [['-c', 'clear the history']],
    examples: [
      ['history', 'everything'],
      ['history 5', 'the last five'],
      ['!!', 'run the last command again'],
    ],
    seeAlso: ['alias'],
  },
  run(ctx) {
    if (ctx.args[0] === '-c') {
      ctx.shell.clearHistory()
      return 0
    }
    const n = ctx.args[0] !== undefined ? Number(ctx.args[0]) : Infinity
    if (Number.isNaN(n)) return usage(ctx, `${ctx.args[0]}: numeric argument required`)
    const h = ctx.shell.history
    const start = Math.max(0, h.length - n)
    const width = String(h.length + ctx.shell.historyOffset).length + 2
    for (let i = start; i < h.length; i++) {
      const num = padStart(String(i + 1 + ctx.shell.historyOffset), Math.max(5, width))
      outln(ctx, dim(num + '  '), ctx.isTTY ? cmd(h[i], h[i], 'plain') : h[i])
    }
    return 0
  },
}

const clear: CommandDef = {
  name: 'clear',
  summary: 'clear the screen',
  kind: 'bin',
  group: 'shell',
  describe: () => 'clear wipes the screen. Ctrl-L does the same.',
  man: {
    synopsis: ['clear'],
    description: ['Clear the screen. Your history and files are untouched. Shortcut: Ctrl-L.'],
    seeAlso: ['reset'],
  },
  run(ctx) {
    if (ctx.isTTY) ctx.shell.host.clear?.()
    return 0
  },
}

const whoami: CommandDef = {
  name: 'whoami',
  summary: 'print your user name',
  kind: 'bin',
  group: 'shell',
  describe: () => 'whoami prints the user you are logged in as.',
  man: {
    synopsis: ['whoami'],
    description: ["Print the current user: guest. Raj's files belong to raj, which is why you can read them but not change them."],
    seeAlso: ['id', 'ls'],
  },
  run(ctx) {
    outln(ctx, ctx.env.USER ?? 'guest')
    return 0
  },
}

const hostname: CommandDef = {
  name: 'hostname',
  summary: 'print the machine name',
  kind: 'bin',
  group: 'shell',
  man: { synopsis: ['hostname'], description: ['Print the name of this machine: curlycloud (as in curlycloud.dev).'] },
  run(ctx) {
    outln(ctx, HOSTNAME)
    return 0
  },
}

function tzName(d: Date): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
  } catch {
    return 'UTC'
  }
}

export function formatDate(d: Date, fmt: string, utc = false): string {
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const g = {
    y: utc ? d.getUTCFullYear() : d.getFullYear(),
    m: utc ? d.getUTCMonth() : d.getMonth(),
    d: utc ? d.getUTCDate() : d.getDate(),
    w: utc ? d.getUTCDay() : d.getDay(),
    H: utc ? d.getUTCHours() : d.getHours(),
    M: utc ? d.getUTCMinutes() : d.getMinutes(),
    S: utc ? d.getUTCSeconds() : d.getSeconds(),
  }
  const p2 = (n: number): string => String(n).padStart(2, '0')
  const map: Record<string, () => string> = {
    Y: () => String(g.y),
    y: () => p2(g.y % 100),
    m: () => p2(g.m + 1),
    d: () => p2(g.d),
    e: () => String(g.d).padStart(2, ' '),
    H: () => p2(g.H),
    I: () => p2(g.H % 12 || 12),
    M: () => p2(g.M),
    S: () => p2(g.S),
    p: () => (g.H < 12 ? 'AM' : 'PM'),
    A: () => DAYS[g.w],
    a: () => DAYS[g.w].slice(0, 3),
    B: () => MONTHS[g.m],
    b: () => MONTHS[g.m].slice(0, 3),
    Z: () => (utc ? 'UTC' : tzName(d)),
    s: () => String(Math.floor(d.getTime() / 1000)),
    F: () => `${g.y}-${p2(g.m + 1)}-${p2(g.d)}`,
    T: () => `${p2(g.H)}:${p2(g.M)}:${p2(g.S)}`,
    R: () => `${p2(g.H)}:${p2(g.M)}`,
    D: () => `${p2(g.m + 1)}/${p2(g.d)}/${p2(g.y % 100)}`,
    n: () => '\n',
    t: () => '\t',
    '%': () => '%',
  }
  return fmt.replace(/%(.)/g, (m, c: string) => (map[c] ? map[c]() : m))
}

const date: CommandDef = {
  name: 'date',
  summary: 'print the date and time',
  kind: 'bin',
  group: 'shell',
  flags: { '-u': 'use UTC instead of local time' },
  operands: [{ kind: 'text', label: '+FORMAT, e.g. +%Y-%m-%d' }],
  describe: (args) => {
    const f = args.find((a) => a.startsWith('+'))
    return f ? `date prints the current date formatted as ${f.slice(1)}.` : 'date prints the current date and time.'
  },
  man: {
    synopsis: ['date [-u] [+FORMAT]'],
    description: ['Print the date and time. +FORMAT picks the layout with % codes: %Y year, %m month, %d day, %H:%M:%S time, %A weekday, %B month name, %Z time zone, %s seconds since 1970.'],
    options: [['-u', 'UTC']],
    examples: [
      ['date', 'now'],
      ['date +%Y-%m-%d', 'ISO date'],
      ['echo "Today is $(date +%A)"', 'inside command substitution'],
    ],
  },
  run(ctx) {
    let utc = false
    let fmt = '%a %b %e %H:%M:%S %Z %Y'
    for (const a of ctx.args) {
      if (a === '-u' || a === '--utc') utc = true
      else if (a.startsWith('+')) fmt = a.slice(1)
      else return usage(ctx, `invalid date '${a}'`)
    }
    outln(ctx, formatDate(ctx.shell.now(), fmt, utc))
    return 0
  },
}

const uname: CommandDef = {
  name: 'uname',
  summary: 'print system information',
  kind: 'bin',
  group: 'shell',
  flags: { '-a': 'everything', '-s': 'kernel name', '-n': 'host name', '-r': 'release', '-m': 'machine' },
  man: {
    synopsis: ['uname [-asnrm]'],
    description: ['Print information about the system. This one is a small shell written in TypeScript, running in your browser, served by Next.js on Cloudflare Workers.'],
    options: [
      ['-a', 'all of it'],
      ['-s', 'system name'],
      ['-n', 'host name'],
      ['-r', 'release'],
      ['-m', 'machine'],
    ],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'asnrmvpio' })
    if (a.error) return usage(ctx, a.error)
    const info = { s: 'CurlyOS', n: HOSTNAME, r: '1.0-rsh', v: '#1 Next.js on Cloudflare Workers', m: 'browser' }
    if (a.flags.has('a')) {
      outln(ctx, `${info.s} ${info.n} ${info.r} ${info.v} ${info.m}`)
      return 0
    }
    const keys = (['s', 'n', 'r', 'v', 'm'] as const).filter((k) => a.flags.has(k))
    outln(ctx, (keys.length ? keys : (['s'] as const)).map((k) => info[k]).join(' '))
    return 0
  },
}

function describeCommand(ctx: CommandContext, name: string, style: 'type' | 'which'): boolean {
  const alias = ctx.shell.aliases.get(name)
  if (alias !== undefined) {
    outln(ctx, style === 'type' ? `${name} is aliased to \`${alias}'` : `${name}: aliased to ${alias}`)
    return true
  }
  const found = ctx.shell.lookupCommand(name, ctx.env.PATH)
  if (!found) return false
  if (!found.path) outln(ctx, style === 'type' ? `${name} is a shell builtin` : `${name}: shell built-in command`)
  else outln(ctx, style === 'type' ? `${name} is ${found.path}` : found.path)
  return true
}

const which: CommandDef = {
  name: 'which',
  summary: 'show where a command lives',
  kind: 'bin',
  group: 'shell',
  operands: [{ kind: 'command', label: 'command name' }],
  describe: (args) => `which searches your PATH for ${args.join(', ')} and prints where it lives.`,
  man: {
    synopsis: ['which COMMAND...'],
    description: [
      'Search the directories in $PATH, left to right, for each command and print the first match. Core tools live in /bin; Raj’s own (resume, ask, learn…) live in /usr/local/bin, which ~/.profile adds to PATH.',
    ],
    examples: [
      ['which ls', '/bin/ls'],
      ['which ask', '/usr/local/bin/ask'],
      ['echo $PATH', 'the search order'],
    ],
    seeAlso: ['type', 'env'],
  },
  run(ctx) {
    if (!ctx.args.length) return usage(ctx, 'missing command name')
    let status = 0
    for (const name of ctx.args) {
      if (!describeCommand(ctx, name, 'which')) {
        writeln(ctx.stderr, err(`which: no ${name} in (${ctx.env.PATH ?? ''})`))
        status = 1
      }
    }
    return status
  },
}

const type: CommandDef = {
  name: 'type',
  summary: 'say what kind of command a name is',
  kind: 'builtin',
  group: 'shell',
  operands: [{ kind: 'command', label: 'command name' }],
  describe: (args) => `type tells you whether ${args.join(', ')} is an alias, a shell builtin or a program on disk.`,
  man: {
    synopsis: ['type NAME...'],
    description: [
      'Say how the shell would run each NAME: an alias (a text shortcut), a builtin (part of the shell itself, like cd), or a program found through $PATH (like /bin/ls).',
    ],
    examples: [
      ['type ll', 'an alias'],
      ['type cd', 'a builtin'],
      ['type grep', 'a program'],
    ],
    seeAlso: ['which', 'alias'],
  },
  run(ctx) {
    let status = 0
    for (const name of ctx.args) {
      if (!describeCommand(ctx, name, 'type')) status = fail(ctx, `${name}: not found`)
    }
    return status
  },
}

const trueCmd: CommandDef = {
  name: 'true',
  summary: 'do nothing, successfully (exit code 0)',
  kind: 'builtin',
  group: 'shell',
  describe: () => 'true does nothing and exits 0 (success).',
  man: {
    synopsis: ['true'],
    description: ['Do nothing and exit with status 0, which means success. Useful for testing && and ||.'],
    examples: [
      ['true && echo yes', 'prints yes'],
      ['true; echo $?', 'prints 0'],
    ],
    seeAlso: ['false'],
  },
  run: () => 0,
}

const falseCmd: CommandDef = {
  name: 'false',
  summary: 'do nothing, unsuccessfully (exit code 1)',
  kind: 'builtin',
  group: 'shell',
  describe: () => 'false does nothing and exits 1 (failure).',
  man: {
    synopsis: ['false'],
    description: ['Do nothing and exit with status 1. Any non-zero exit code means failure.'],
    examples: [
      ['false || echo "that failed"', 'prints the message'],
      ['false; echo $?', 'prints 1'],
    ],
    seeAlso: ['true'],
  },
  run: () => 1,
}

const exit: CommandDef = {
  name: 'exit',
  summary: 'leave the terminal (back to the website)',
  kind: 'builtin',
  group: 'shell',
  describe: () => 'exit ends the shell session. Here it takes you back to the website.',
  man: {
    synopsis: ['exit [N]'],
    description: ['End the shell with exit code N (default: the last command’s). In a subshell like (exit 3) it only ends the subshell. Here, at the top level, it logs you out and takes you back to the website.'],
    examples: [
      ['(exit 3); echo $?', 'exit codes from a subshell'],
      ['exit', 'back to the website'],
    ],
    seeAlso: ['website', 'open'],
  },
  run(ctx) {
    const code = ctx.args[0] !== undefined ? Number(ctx.args[0]) & 255 : ctx.shell.lastStatus
    if (Number.isNaN(code)) return usage(ctx, `${ctx.args[0]}: numeric argument required`)
    if (ctx.shell.subshellDepth > 0) return code
    outln(ctx, dim('logout'))
    outln(ctx, dim('Taking you back to the website…'))
    ctx.shell.host.navigate?.('/', { external: false })
    return code
  },
}

function sourceDef(name: string, hidden: boolean): CommandDef {
  return {
    name,
    summary: 'run the commands in a file, in this shell',
    kind: 'builtin',
    group: 'shell',
    hidden,
    operands: [{ kind: 'file', label: 'script to run' }],
    describe: (args) => `${name} runs each line of ${args[0] ?? 'a file'} in the current shell, so its variables and aliases stay set afterwards.`,
    man: {
      synopsis: [`${name} FILE`],
      description: [
        'Read FILE and run its lines in the current shell. Because it is this shell (not a new one), variables, aliases and cd all stick afterwards. That is how ~/.profile sets up your environment at login.',
      ],
      examples: [
        ['cat ~/.profile', 'see what login runs'],
        ['source ~/.profile', 'run it again'],
        ["echo 'alias hi=\"echo hello\"' > /tmp/rc; source /tmp/rc; hi", 'write and source your own'],
      ],
      seeAlso: ['export', 'alias'],
    },
    async run(ctx) {
      const file = ctx.args[0]
      if (!file) return usage(ctx, 'filename argument required')
      const abs = ctx.shell.resolve(file)
      let text: string
      try {
        text = ctx.shell.vfs.read(abs)
      } catch (e) {
        return fail(ctx, `${file}: ${(e as Error).message}`)
      }
      return ctx.shell.runScript(text, ioOf(ctx))
    },
  }
}

const reset: CommandDef = {
  name: 'reset',
  summary: 'wipe your history, variables, files and progress',
  kind: 'builtin',
  group: 'shell',
  flags: { '-f': "don't ask for confirmation" },
  describe: () => 'reset wipes everything you changed here (history, variables, aliases, files in /tmp, learn progress) and logs in fresh.',
  man: {
    synopsis: ['reset [-f]'],
    description: [
      'Forget everything this browser saved for the terminal: history, exported variables, aliases, your files in /tmp and learn progress. Then log in fresh, as if for the first time.',
      "If you broke something (say, unset PATH), this fixes it. It's a builtin, so it works even without PATH.",
    ],
    options: [['-f', 'skip the confirmation']],
  },
  async run(ctx) {
    if (!ctx.args.includes('-f') && ctx.readLine && ctx.stdin === null) {
      const answer = await ctx.readLine([seg('Wipe history, variables, aliases, /tmp and learn progress? [y/N] ', 'highlight')], { signal: ctx.signal })
      if (!answer || !/^y(es)?$/i.test(answer.trim())) {
        outln(ctx, dim('Nothing changed.'))
        return 1
      }
    }
    await ctx.shell.resetAll()
    if (ctx.isTTY) ctx.shell.host.clear?.()
    outln(ctx, dim('Everything is back to how it was on your first visit.'))
    for (const line of ctx.shell.welcome()) outln(ctx, line)
    return 0
  },
}

export const BUILTIN_COMMANDS: CommandDef[] = [
  env,
  printenv,
  set,
  exportCmd,
  unset,
  alias,
  unalias,
  history,
  clear,
  whoami,
  hostname,
  date,
  uname,
  which,
  type,
  trueCmd,
  falseCmd,
  exit,
  sourceDef('source', false),
  sourceDef('.', true),
  reset,
]
