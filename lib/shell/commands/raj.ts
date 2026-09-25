import { RESUME, resumeMarkdown } from '@/content/resume'
import { parseArgs } from '../args'
import { fail, ioOf, out, outln, readInputs, splitLines, usage, type CommandDef } from '../command'
import { companySlug, HOME, HOSTNAME } from '../fs-content'
import { accent, cmd, dim, hi, pad, route, seg, strong, url, writeln, type Printable } from '../output'
import { styleFileLine } from './files'

const linkFor = (label: string): string | undefined => RESUME.links.find((l) => l.label.toLowerCase() === label)?.href

const resume: CommandDef = {
  name: 'resume',
  summary: "Raj's resume, formatted",
  kind: 'local',
  group: 'raj',
  flags: { '--json': 'the structured data behind the site', '--md': 'plain markdown (the same as resume.md)' },
  describe: (args) => (args.includes('--json') ? 'resume --json prints the resume as JSON, the same data the website and MCP server use.' : "resume prints Raj's resume."),
  man: {
    synopsis: ['resume [--json | --md]'],
    description: [
      "Print Raj's resume. It is generated from the same data as the website, the MCP server and the files in this home directory, so they never disagree.",
    ],
    options: [
      ['--json', 'structured JSON (pipe it: resume --json | grep period)'],
      ['--md', 'markdown, like cat resume.md'],
    ],
    examples: [
      ['resume', 'the formatted version'],
      ['resume --json | head -20', 'the data'],
    ],
    seeAlso: ['contact', 'skills', 'projects', 'cat'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { long: ['json', 'md', 'markdown'] })
    if (a.error) return usage(ctx, a.error)
    if (a.flags.has('json')) {
      out(ctx, JSON.stringify(RESUME, null, 2) + '\n')
      return 0
    }
    if (a.flags.has('md') || a.flags.has('markdown') || !ctx.isTTY) {
      out(ctx, resumeMarkdown(RESUME))
      return 0
    }
    const r = RESUME
    outln(ctx, strong(r.name), dim('  ·  '), hi(r.role), dim(`  ·  ${r.location}`))
    outln(ctx, r.headline)
    outln(ctx, url(`mailto:${r.email}`, r.email), ...r.links.flatMap((l) => [dim('  ·  '), url(l.href, l.href.replace(/^https?:\/\//, ''))]))
    outln(ctx)
    outln(ctx, hi('SUMMARY'))
    for (const p of r.summary) outln(ctx, p)
    outln(ctx)
    outln(ctx, hi('EXPERIENCE'))
    for (const role of r.experience) {
      outln(ctx)
      outln(ctx, strong(role.role), dim(' at '), cmd(`cat ~/experience/${companySlug(role.company)}.md`, role.company))
      outln(ctx, dim(`${role.location} · ${role.period}`))
      if (role.blurb) outln(ctx, dim(role.blurb))
      for (const b of role.bullets) outln(ctx, accent('• '), b.text)
    }
    outln(ctx)
    outln(ctx, hi('INDEPENDENT BUILDS'))
    for (const b of r.builds) {
      outln(ctx)
      outln(ctx, cmd(`cat ~/builds/${b.id}.md`, b.title, 'strong'))
      outln(ctx, dim(`${b.period} · ${b.stack.join(', ')}`))
      for (const x of b.bullets) outln(ctx, accent('• '), x.text)
    }
    outln(ctx)
    outln(ctx, hi('SKILLS'))
    for (const g of r.skills) outln(ctx, strong(g.label + ': '), g.items.map((i) => i.label).join(', '))
    outln(ctx)
    outln(ctx, hi('EDUCATION'))
    for (const e of r.education) outln(ctx, accent('• '), `${e.credential}, ${e.school} `, dim(`(${e.period})`))
    outln(ctx)
    outln(ctx, dim('Also: '), cmd('resume --json'), dim(' · '), cmd('cat resume.md'), dim(' · '), route('/', 'the website'))
    return 0
  },
}

const contact: CommandDef = {
  name: 'contact',
  summary: 'how to reach Raj',
  kind: 'local',
  group: 'raj',
  man: {
    synopsis: ['contact'],
    description: ['Print how to reach Raj: email, LinkedIn, GitHub and the website. On screen, each is clickable. The same text is in ~/contact.txt.'],
    examples: [
      ['contact', 'the details'],
      ['open email', 'start an email'],
    ],
    seeAlso: ['open', 'resume'],
  },
  run(ctx) {
    const r = RESUME
    if (!ctx.isTTY) {
      out(ctx, ctx.shell.vfs.read(`${HOME}/contact.txt`))
      return 0
    }
    const w = 10
    outln(ctx, strong(r.name), dim(`  ·  ${r.location}`))
    outln(ctx)
    outln(ctx, dim(pad('email', w)), url(`mailto:${r.email}`, r.email))
    for (const l of r.links) outln(ctx, dim(pad(l.label, w)), url(l.href, l.href.replace(/^https?:\/\//, '')))
    outln(ctx)
    outln(ctx, dim('Or ask the clone: '), cmd('ask "are you open to new roles?"'))
    return 0
  },
}

function projectsDef(name: string, hidden: boolean): CommandDef {
  return {
    name,
    summary: "Raj's independent builds",
    kind: 'local',
    group: 'raj',
    hidden,
    operands: [{ kind: 'name', label: 'build id (e.g. regdocs)' }],
    describe: () => `${name} lists the projects Raj built end to end on his own.`,
    complete: () => RESUME.builds.map((b) => b.id),
    man: {
      synopsis: [`${name} [ID]`],
      description: [
        'List the projects Raj built end to end on his own, with their stack. Give an id for the full write-up (the same as cat ~/builds/ID.md).',
      ],
      examples: RESUME.builds.map((b) => [`${name} ${b.id}`, b.title] as [string, string]),
      seeAlso: ['resume', 'skills'],
    },
    run(ctx) {
      const id = ctx.args[0]
      if (id) {
        const b = RESUME.builds.find((x) => x.id === id)
        if (!b) return fail(ctx, `no build called '${id}'. Try: ${RESUME.builds.map((x) => x.id).join(', ')}`)
        for (const line of splitLines(ctx.shell.vfs.read(`${HOME}/builds/${b.id}.md`))) outln(ctx, styleFileLine(line, `${b.id}.md`, ctx.isTTY))
        return 0
      }
      RESUME.builds.forEach((b, i) => {
        if (i) outln(ctx)
        outln(ctx, cmd(`${name} ${b.id}`, b.title, 'strong'))
        outln(ctx, dim(`${b.period} · ${b.stack.join(', ')}`))
        outln(ctx, b.bullets[0].text)
      })
      outln(ctx)
      outln(ctx, dim('Also in '), cmd('ls ~/builds', '~/builds'), dim('. Client and employer work: '), cmd('ls ~/experience', '~/experience'))
      return 0
    },
  }
}

const skills: CommandDef = {
  name: 'skills',
  summary: "Raj's skills, by area",
  kind: 'local',
  group: 'raj',
  flags: { '--grep': 'only skills matching a word' },
  valueFlags: ['--grep'],
  operands: [{ kind: 'name', label: 'area (e.g. retrieval)' }],
  complete: () => RESUME.skills.map((g) => g.id),
  describe: (args) => {
    const i = args.indexOf('--grep')
    return i >= 0 ? `skills lists Raj's skills that mention "${args[i + 1]}".` : "skills lists Raj's skills, grouped by area."
  },
  man: {
    synopsis: ['skills [AREA] [--grep WORD]'],
    description: ['List skills by area. Give an area id to see one group, or --grep to filter. Each area is also a file in ~/skills.'],
    options: [['--grep WORD', 'only matching skills (case-insensitive)']],
    examples: [
      ['skills', 'everything'],
      ['skills retrieval', 'one area'],
      ['skills --grep aws', 'search'],
    ],
    seeAlso: ['resume', 'grep'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { longValue: ['grep'] })
    if (a.error) return usage(ctx, a.error)
    const term = a.values.get('grep')?.toLowerCase()
    const area = a.operands[0]
    const groups = RESUME.skills.filter((g) => !area || g.id === area || g.label.toLowerCase().includes(area.toLowerCase()))
    if (area && !groups.length) return fail(ctx, `no area '${area}'. Try: ${RESUME.skills.map((g) => g.id).join(', ')}`)
    let shown = 0
    for (const g of groups) {
      const items = g.items.filter((i) => !term || i.label.toLowerCase().includes(term) || i.id.includes(term))
      if (!items.length) continue
      if (shown) outln(ctx)
      outln(ctx, hi(g.label), dim(`  (${g.id})`))
      for (const i of items) outln(ctx, accent('  • '), i.label)
      shown++
    }
    if (!shown) {
      outln(ctx, dim(`Nothing matches '${term}'. The clone may know more: `), cmd(`ask "have you used ${term}?"`))
      return 1
    }
    return 0
  },
}

interface OpenTarget {
  href: string
  external: boolean
  label: string
}

function openTargets(): Record<string, OpenTarget> {
  const github = linkFor('github')
  const linkedin = linkFor('linkedin')
  const targets: Record<string, OpenTarget> = {
    mac: { href: '/mac', external: false, label: 'the 1984 Macintosh' },
    macintosh: { href: '/mac', external: false, label: 'the 1984 Macintosh' },
    website: { href: '/', external: false, label: 'the website' },
    site: { href: '/', external: false, label: 'the website' },
    home: { href: '/', external: false, label: 'the website' },
    email: { href: `mailto:${RESUME.email}`, external: true, label: `an email to ${RESUME.email}` },
    mail: { href: `mailto:${RESUME.email}`, external: true, label: `an email to ${RESUME.email}` },
    'llms.txt': { href: '/llms.txt', external: false, label: 'the agent-readable summary' },
  }
  if (github) targets.github = { href: github, external: true, label: 'GitHub' }
  if (linkedin) targets.linkedin = { href: linkedin, external: true, label: 'LinkedIn' }
  return targets
}

export const OPEN_TARGETS = Object.keys(openTargets()).concat('terminal')

const open: CommandDef = {
  name: 'open',
  summary: 'open the Mac, the website, GitHub, LinkedIn or email',
  kind: 'local',
  group: 'raj',
  operands: [{ kind: 'target', label: 'what to open' }],
  complete: () => OPEN_TARGETS,
  describe: (args) => {
    const t = openTargets()[args[0]?.toLowerCase() ?? '']
    return t ? `open takes you to ${t.label}.` : `open shows or opens ${args[0] ?? 'something'}.`
  },
  man: {
    synopsis: ['open TARGET'],
    description: [
      'Open something outside the terminal. Targets: mac (or macintosh) for the 1984 desktop, website, github, linkedin, email. A file in this filesystem is printed instead. A URL opens in a new tab.',
    ],
    examples: [
      ['open macintosh', 'the Mac version of this site'],
      ['open github', 'Raj on GitHub'],
      ['open email', 'write to Raj'],
    ],
    seeAlso: ['contact', 'website'],
  },
  run(ctx) {
    const raw = ctx.args[0]
    if (!raw) {
      outln(ctx, 'Open what? Try one of:')
      outln(ctx, ...OPEN_TARGETS.filter((t) => !['macintosh', 'site', 'home', 'mail', 'terminal'].includes(t)).flatMap((t, i) => [i ? dim(' · ') : '  ', cmd(`open ${t}`, t)]))
      return 1
    }
    const key = raw.toLowerCase()
    if (key === 'terminal') {
      outln(ctx, "You're already in it.")
      return 0
    }
    let target = openTargets()[key]
    if (!target) {
      const abs = ctx.shell.resolve(raw)
      const node = ctx.shell.vfs.stat(abs)
      if (node) {
        if (node.type === 'dir') return ctx.shell.execArgv(['ls', raw], [], ioOf(ctx))
        return readInputs(ctx, [raw], (text, name) => {
          for (const line of splitLines(text)) outln(ctx, styleFileLine(line, name, ctx.isTTY))
        })
      }
      if (/^https?:\/\/\S+$/.test(raw)) target = { href: raw, external: true, label: raw }
      else if (/^\/[\w\-/#.]*$/.test(raw)) target = { href: raw, external: false, label: raw }
    }
    if (!target) return fail(ctx, `don't know how to open '${raw}'. Try: open mac · open website · open github · open email`)
    const link = target.external ? url(target.href, target.href) : route(target.href, target.href)
    outln(ctx, dim(`Opening ${target.label}… `), link)
    ctx.shell.host.navigate?.(target.href, { external: target.external })
    return 0
  },
}

function websiteDef(name: string): CommandDef {
  return {
    name,
    summary: 'switch back to the website',
    kind: 'local',
    group: 'raj',
    hidden: name === 'gui',
    describe: () => `${name} switches back to the graphical website.`,
    man: { synopsis: [name], description: ['Switch back to the graphical website. The same as the Website button at the top, or exit.'], seeAlso: ['open', 'exit'] },
    run(ctx) {
      outln(ctx, dim('Switching to the website… '), route('/', '/'))
      ctx.shell.host.navigate?.('/', { external: false })
      return 0
    },
  }
}

const CLOUD = [
  '        .-~~~-.        ',
  '  .- ~ ~-(     )_ _    ',
  ' /                ~ -. ',
  '|    raj@curly       \\ ',
  ' \\                  .\' ',
  "   ~- . _____ . -~     ",
  '                       ',
  '   ~ curlycloud.dev ~  ',
]

const neofetch: CommandDef = {
  name: 'neofetch',
  summary: 'system info, Raj edition',
  kind: 'local',
  group: 'fun',
  man: { synopsis: ['neofetch'], description: ['Show system information next to a logo, the way people show off their terminals. This one is about Raj.'] },
  run(ctx) {
    const r = RESUME
    const now = r.experience.find((x) => x.end === null) ?? r.experience[0]
    const firstYear = Math.min(...r.experience.map((x) => Number(x.start.slice(0, 4))))
    const years = ctx.shell.now().getFullYear() - firstYear
    const info: Printable[][] = [
      [accent('guest'), dim('@'), accent(HOSTNAME)],
      [dim('-'.repeat(`guest@${HOSTNAME}`.length))],
      [hi('OS'), ': CurlyOS 1.0 (rsh)'],
      [hi('Host'), ': curlycloud.dev'],
      [hi('Kernel'), ': Next.js on Cloudflare Workers'],
      [hi('Uptime'), `: ${years} years shipping production software`],
      [hi('Role'), `: ${r.role} @ ${now.company}`],
      [hi('Location'), `: ${r.location}`],
      [hi('Focus'), ': MCP servers, RAG, agents, evals, guardrails'],
      [hi('Languages'), ': Python, TypeScript, C#/.NET, SQL'],
      [hi('Editor'), ': Claude Code (interactive and headless)'],
      [hi('Contact'), ': ', url(`mailto:${r.email}`, r.email)],
      [],
      [seg('███', 'accent'), seg('███', 'highlight'), seg('███', 'prompt'), seg('███', 'dim'), seg('███')],
    ]
    const wide = ctx.shell.columns() >= 60 && ctx.isTTY
    if (!wide) {
      for (const l of CLOUD.slice(0, 6)) outln(ctx, accent(l))
      for (const l of info) outln(ctx, l)
      return 0
    }
    const rows = Math.max(CLOUD.length, info.length)
    for (let i = 0; i < rows; i++) outln(ctx, accent(pad(CLOUD[i] ?? '', 25)), info[i] ?? [])
    return 0
  },
}

/** Raj-isms, taken only from public resume content. */
export function fortunes(): string[] {
  const r = RESUME
  const sentences = [r.pitch, ...r.summary].flatMap((p) => p.split(/(?<=\.)\s+/)).filter((s) => s.length > 40)
  return [
    ...new Set([
      ...sentences,
      'Build LLM features that make it past the demo.',
      'Take one problem, go to the bottom of it for a few weeks, ship it, then carry what you learned into the next domain.',
      'It worked, but per-user inference cost did not justify shipping it. Document the trade-off for when model prices fall.',
      'Measure the tool latency, cost the production version, and be willing to recommend stopping there.',
      'Hold the production release pending a generation eval.',
      'A comment is attributed to the person who made it, not to a shared token.',
      'Every change is reviewed and tested before it ships.',
    ]),
  ]
}

const fortune: CommandDef = {
  name: 'fortune',
  summary: 'a random Raj-ism',
  kind: 'local',
  group: 'fun',
  man: { synopsis: ['fortune'], description: ["Print a random saying. These come from Raj's own resume."], examples: [['fortune | cowsay', 'the classic']] },
  run(ctx) {
    const list = fortunes()
    outln(ctx, list[Math.floor(ctx.shell.random() * list.length)])
    return 0
  },
}

function wrap(text: string, width: number): string[] {
  const lines: string[] = []
  let cur = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + word).length > width) {
      lines.push(cur)
      cur = word
    } else cur = cur ? `${cur} ${word}` : word
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

const cowsay: CommandDef = {
  name: 'cowsay',
  summary: 'a cow says something',
  kind: 'local',
  group: 'fun',
  operands: [{ kind: 'text', label: 'what the cow says' }],
  man: { synopsis: ['cowsay [TEXT]'], description: ['A cow says TEXT (or its input, or a fortune).'], examples: [['cowsay moo', 'moo'], ['fortune | cowsay', 'wisdom']] },
  run(ctx) {
    const text = ctx.args.length ? ctx.args.join(' ') : ctx.stdin?.trim() || fortunes()[Math.floor(ctx.shell.random() * fortunes().length)]
    const lines = wrap(text, Math.min(40, Math.max(16, ctx.shell.columns() - 8)))
    const w = Math.max(...lines.map((l) => l.length))
    const bubble = [` ${'_'.repeat(w + 2)}`]
    lines.forEach((l, i) => {
      const [o, c] = lines.length === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|']
      bubble.push(`${o} ${pad(l, w)} ${c}`)
    })
    bubble.push(` ${'-'.repeat(w + 2)}`)
    const cow = ['        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||']
    out(ctx, [...bubble, ...cow].join('\n') + '\n')
    return 0
  },
}

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ01RAJMCPRAG'

const matrix: CommandDef = {
  name: 'matrix',
  summary: 'digital rain (Ctrl-C to stop)',
  kind: 'local',
  group: 'fun',
  man: { synopsis: ['matrix'], description: ['Falling green characters for a few seconds. Ctrl-C stops it early. With reduced motion turned on, you get a still frame instead.'] },
  async run(ctx) {
    const cols = Math.max(10, Math.min(ctx.shell.columns(), 100))
    const row = (): Printable[] => {
      let s = ''
      for (let i = 0; i < cols; i++) s += ctx.shell.random() < 0.35 ? GLYPHS[Math.floor(ctx.shell.random() * GLYPHS.length)] : ' '
      return [seg(s, ctx.shell.random() < 0.3 ? 'dim' : 'accent')]
    }
    const still = !ctx.isTTY || ctx.shell.host.reducedMotion?.()
    const frames = still ? 8 : 60
    for (let i = 0; i < frames; i++) {
      if (ctx.signal.aborted) return 130
      outln(ctx, row())
      if (!still) await ctx.shell.sleep(50, ctx.signal)
    }
    if (still && ctx.isTTY) outln(ctx, dim('(reduced motion is on, so here is a still frame)'))
    else outln(ctx, dim('Wake up, guest. Follow the white rabbit: '), cmd('learn'))
    return 0
  },
}

const sudo: CommandDef = {
  name: 'sudo',
  summary: 'run a command as root (it will not work)',
  kind: 'bin',
  group: 'fun',
  operands: [{ kind: 'command', label: 'command to run as root' }],
  describe: (args) => `sudo tries to run ${args.join(' ') || 'a command'} as the superuser (root). Guests aren't allowed to.`,
  man: {
    synopsis: ['sudo COMMAND...'],
    description: [
      'Run a command as the superuser, root, who can read and change anything. Only users listed in /etc/sudoers may do it; guest is not one of them. That is the whole point of permissions.',
    ],
    seeAlso: ['whoami', 'ls'],
  },
  run(ctx) {
    const line = ctx.args.join(' ')
    if (/^make me a sandwich$/i.test(line)) {
      outln(ctx, 'Okay.')
      return 0
    }
    writeln(ctx.stderr, seg('[sudo] password for guest: ', 'dim'))
    writeln(ctx.stderr, seg('guest is not in the sudoers file. This incident will be reported.', 'error'))
    writeln(ctx.stderr, dim('(Reported to Raj, who will find it funny. Guests can read everything except ~/.secrets, and write only in /tmp.)'))
    return 1
  },
}

export const RAJ_COMMANDS: CommandDef[] = [
  resume,
  contact,
  projectsDef('projects', false),
  projectsDef('builds', true),
  skills,
  open,
  websiteDef('website'),
  websiteDef('gui'),
  neofetch,
  fortune,
  cowsay,
  matrix,
  sudo,
]

