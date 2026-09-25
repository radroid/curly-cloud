import { parseArgs } from '../args'
import { fail, fsFail, outln, readInputs, splitLines, usage, type CommandContext, type CommandDef } from '../command'
import { cmd, dim, pad, padStart, seg, url, writeln, type Printable } from '../output'
import { quoteArg } from '../shell'
import type { Segment } from '../types'
import { basename, byteLength, FsError, joinPath, modeString, normalizePath, type VNode } from '../vfs'
import { matchGlob } from '../glob'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A file or directory name that runs something useful when clicked. */
export function pathSegment(ctx: CommandContext, shown: string, node: VNode | null, label = shown): Segment {
  if (!ctx.isTTY || !node) return seg(label)
  if (node.type === 'dir') return seg(label, 'accent', { kind: 'command', command: `cd ${quoteArg(shown)} && ls` })
  if (node.mode & 0o111) return seg(label, 'highlight', { kind: 'command', command: `man ${basename(shown)}` })
  if (node.mode & 0o044 || node.owner === 'guest') return seg(label, undefined, { kind: 'command', command: `cat ${quoteArg(shown)}` })
  return seg(label, 'dim')
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes)
  const units = ['K', 'M', 'G']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}${units[i]}`
}

function lsDate(mtime: number, now: Date): string {
  const d = new Date(mtime)
  const day = String(d.getDate()).padStart(2, ' ')
  const recent = Math.abs(now.getTime() - mtime) < 182 * 24 * 3600 * 1000
  const tail = recent ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ` ${d.getFullYear()}`
  return `${MONTHS[d.getMonth()]} ${day} ${tail}`
}

function nodeSize(node: VNode): number {
  return node.type === 'dir' ? 4096 : byteLength(node.content ?? '')
}

const ls: CommandDef = {
  name: 'ls',
  summary: 'list directory contents',
  kind: 'bin',
  group: 'files',
  flags: {
    '-l': 'long format: permissions, owner, size and date',
    '-a': 'all: include hidden files (names starting with .)',
    '-A': 'almost all: hidden files, but not . and ..',
    '-1': 'one name per line',
    '-h': 'human-readable sizes (1.2K)',
  },
  operands: [{ kind: 'path', label: 'directory or file to list' }],
  describe: (args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    const long = args.some((a) => /^-\w*l/.test(a))
    const all = args.some((a) => /^-\w*[aA]/.test(a))
    return `ls lists ${ops.length ? ops.join(' and ') : 'the current directory'}${all ? ', including hidden files' : ''}${long ? ', with permissions, owner, size and date' : ''}.`
  },
  man: {
    synopsis: ['ls [-laAh1] [PATH...]'],
    description: [
      'List the files in each directory (default: the current one). Names starting with a dot are hidden unless you pass -a.',
      'In long format (-l) the first column is the permissions: d for directory, then read/write/execute for the owner, the group and everyone else. Raj owns his files, so as guest you only get the last three.',
    ],
    options: [
      ['-l', 'long format: permissions, links, owner, group, size, date, name'],
      ['-a', 'show hidden files, plus . (this directory) and .. (its parent)'],
      ['-A', 'show hidden files, without . and ..'],
      ['-h', 'sizes like 1.2K instead of bytes'],
      ['-1', 'one entry per line (the default when piped)'],
    ],
    examples: [
      ['ls', 'what is here'],
      ['ls -la', 'everything, in detail'],
      ['ls experience', 'inside another directory'],
      ['ls -l /tmp', 'your own files'],
    ],
    seeAlso: ['cd', 'tree', 'find'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'laAh1dF' })
    if (a.error) return usage(ctx, a.error)
    const long = a.flags.has('l')
    const all = a.flags.has('a')
    const almost = a.flags.has('A')
    const oneCol = a.flags.has('1') || !ctx.isTTY
    const vfs = ctx.shell.vfs
    const now = ctx.shell.now()
    const operands = a.operands.length ? a.operands : ['.']
    let status = 0
    const files: string[] = []
    const dirs: string[] = []
    for (const op of operands) {
      let node: VNode
      try {
        node = vfs.lookup(ctx.shell.resolve(op))
      } catch (e) {
        fail(ctx, `cannot access '${op}': ${(e as FsError).message}`)
        status = 2
        continue
      }
      if (node.type === 'dir' && !a.flags.has('d')) dirs.push(op)
      else files.push(op)
    }

    const render = (entries: { shown: string; label: string; node: VNode }[]): void => {
      if (long) {
        const sizes = entries.map((e) => (a.flags.has('h') ? humanSize(nodeSize(e.node)) : String(nodeSize(e.node))))
        const sizeW = Math.max(0, ...sizes.map((s) => s.length))
        entries.forEach((e, i) => {
          const links = e.node.type === 'dir' ? 2 : 1
          outln(
            ctx,
            seg(modeString(e.node), e.node.owner === 'guest' ? undefined : 'dim'),
            seg(` ${links} `),
            seg(pad(e.node.owner, 5) + ' ' + pad(e.node.owner, 5), e.node.owner === 'guest' ? 'highlight' : 'dim'),
            seg(` ${padStart(sizes[i], sizeW)} ${lsDate(e.node.mtime, now)} `, 'dim'),
            pathSegment(ctx, e.shown, e.node, e.label),
          )
        })
        return
      }
      if (oneCol) {
        for (const e of entries) outln(ctx, pathSegment(ctx, e.shown, e.node, e.label))
        return
      }
      const parts: Printable[] = []
      entries.forEach((e, i) => {
        if (i) parts.push('  ')
        parts.push(pathSegment(ctx, e.shown, e.node, e.label))
      })
      if (entries.length) outln(ctx, parts)
    }

    if (files.length) {
      render(files.map((f) => ({ shown: f, label: f, node: vfs.stat(ctx.shell.resolve(f))! })))
    }
    dirs.forEach((d, idx) => {
      const abs = ctx.shell.resolve(d)
      let names: string[]
      try {
        names = vfs.list(abs)
      } catch (e) {
        status = fsFail(ctx, d, e)
        return
      }
      if (files.length || dirs.length > 1) {
        if (files.length || idx > 0) outln(ctx)
        outln(ctx, seg(`${d}:`, 'strong'))
      }
      if (!all && !almost) names = names.filter((n) => !n.startsWith('.'))
      const entries = names.map((n) => {
        const shown = d === '.' ? n : d.endsWith('/') ? d + n : `${d}/${n}`
        return { shown, label: n, node: vfs.stat(joinPath(abs, n))! }
      })
      if (all) {
        entries.unshift(
          { shown: d === '.' ? '..' : `${d}/..`, label: '..', node: vfs.stat(normalizePath(`${abs}/..`))! },
        )
        entries.unshift({ shown: d, label: '.', node: vfs.stat(abs)! })
      }
      if (long) {
        const blocks = entries.reduce((sum, e) => sum + (e.node.type === 'dir' ? 4 : Math.ceil(nodeSize(e.node) / 4096) * 4), 0)
        outln(ctx, dim(`total ${blocks}`))
      }
      render(entries)
    })
    return status
  },
}

const cd: CommandDef = {
  name: 'cd',
  summary: 'change the working directory',
  kind: 'builtin',
  group: 'files',
  operands: [{ kind: 'dir', label: 'directory to move into' }],
  describe: (args) => {
    const d = args[0]
    if (!d || d === '~') return 'cd with no directory takes you home (~ = /home/raj).'
    if (d === '-') return 'cd - jumps back to the previous directory ($OLDPWD).'
    if (d === '..') return 'cd .. moves up to the parent directory.'
    return `cd moves you into ${d}; the prompt will show the new location.`
  },
  man: {
    synopsis: ['cd [DIR]', 'cd -'],
    description: [
      'Change the working directory: the directory that relative paths (like about.txt or ../builds) start from. The prompt shows where you are.',
      'With no argument, cd goes home ($HOME). cd - goes back to where you just were ($OLDPWD) and prints it. .. means the parent directory, . means this one.',
      'cd is a shell builtin: it has to be, because a separate program cannot change the shell’s own directory.',
    ],
    examples: [
      ['cd experience', 'go into a directory'],
      ['cd ..', 'up one level'],
      ['cd ~/builds', 'from anywhere, via home'],
      ['cd -', 'back to the previous directory'],
      ['cd', 'home'],
    ],
    seeAlso: ['pwd', 'ls'],
  },
  run(ctx) {
    if (ctx.args.length > 1) return fail(ctx, 'too many arguments')
    let target = ctx.args[0]
    let print = false
    if (target === undefined || target === '') target = ctx.shell.getVar('HOME') ?? '/'
    else if (target === '-') {
      target = ctx.shell.getVar('OLDPWD') ?? ctx.shell.cwd
      print = true
    }
    const abs = ctx.shell.resolve(target)
    try {
      const node = ctx.shell.vfs.lookup(abs)
      if (node.type !== 'dir') throw new FsError('ENOTDIR', abs)
    } catch (e) {
      return fail(ctx, `${ctx.args[0] ?? target}: ${(e as FsError).message}`)
    }
    ctx.shell.chdir(abs)
    if (print) outln(ctx, abs)
    return 0
  },
}

const pwd: CommandDef = {
  name: 'pwd',
  summary: 'print the working directory',
  kind: 'builtin',
  group: 'files',
  describe: () => 'pwd prints the full path of the directory you are in.',
  man: {
    synopsis: ['pwd'],
    description: ['Print the absolute path of the working directory. The prompt shows the same place, with your home shortened to ~.'],
    examples: [['pwd', 'where am I?']],
    seeAlso: ['cd'],
  },
  run(ctx) {
    outln(ctx, ctx.shell.cwd)
    return 0
  },
}

const URL_RE = /(https?:\/\/[^\s)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g

/** Syntax colouring and clickable links for files shown on screen. */
export function styleFileLine(line: string, name: string | null, isTTY: boolean): Segment[] {
  if (!isTTY) return [seg(line)]
  let style: Segment['style']
  if (name && /\.md$/.test(name) && /^#{1,6} /.test(line)) style = 'highlight'
  else if (name && /(^|\/)\.[a-z]+$|\.sh$/.test(name) && /^\s*#/.test(line)) style = 'dim'
  const out: Segment[] = []
  let last = 0
  for (const m of line.matchAll(URL_RE)) {
    if (m.index! > last) out.push(seg(line.slice(last, m.index), style))
    const text = m[0]
    out.push(url(text.includes('@') && !text.startsWith('http') ? `mailto:${text}` : text, text))
    last = m.index! + text.length
  }
  if (last < line.length) out.push(seg(line.slice(last), style))
  return out
}

const cat: CommandDef = {
  name: 'cat',
  summary: 'print files',
  kind: 'bin',
  group: 'files',
  flags: { '-n': 'number each line' },
  operands: [{ kind: 'file', label: 'file to print' }],
  describe: (args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    if (!ops.length) return 'cat copies its input (from a pipe) to the output.'
    return ops.length > 1 ? `cat prints ${ops.join(', ')} one after another (cat is short for concatenate).` : `cat prints the contents of ${ops[0]}.`
  },
  man: {
    synopsis: ['cat [-n] [FILE...]'],
    description: [
      'Print files one after another (cat is short for concatenate). With no file, or with -, it copies its input, so it also works at the end of a pipe.',
    ],
    options: [['-n', 'number the output lines']],
    examples: [
      ['cat about.txt', 'print a file'],
      ['cat experience/*.md', 'every role, via a glob'],
      ['cat -n .profile', 'with line numbers'],
    ],
    seeAlso: ['head', 'tail', 'less', 'grep'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'nAsuv' })
    if (a.error) return usage(ctx, a.error)
    let n = 0
    return readInputs(ctx, a.operands, (text, name) => {
      // Every line gets a newline, even a file's last one, so the prompt starts on its own line.
      for (const line of splitLines(text)) {
        const prefix = a.flags.has('n') ? [dim(`${padStart(String(++n), 6)}  `)] : []
        outln(ctx, prefix, styleFileLine(line, name, ctx.isTTY))
      }
    })
  },
}

const tree: CommandDef = {
  name: 'tree',
  summary: 'show a directory tree',
  kind: 'bin',
  group: 'files',
  flags: { '-a': 'include hidden files', '-L': 'limit the depth', '-d': 'directories only' },
  valueFlags: ['-L'],
  operands: [{ kind: 'dir', label: 'directory to draw' }],
  describe: (args) => `tree draws ${args.filter((a) => !a.startsWith('-'))[0] ?? 'the current directory'} and everything below it as a tree.`,
  man: {
    synopsis: ['tree [-a] [-d] [-L LEVEL] [DIR]'],
    description: ['Draw a directory and everything below it as an indented tree, then count the directories and files.'],
    options: [
      ['-a', 'include hidden files'],
      ['-d', 'directories only'],
      ['-L N', 'descend at most N levels'],
    ],
    examples: [
      ['tree', "Raj's whole home directory"],
      ['tree -L 1 /', 'the top of the filesystem'],
    ],
    seeAlso: ['ls', 'find'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'ad', value: 'L' })
    if (a.error) return usage(ctx, a.error)
    const maxDepth = a.values.has('L') ? Number(a.values.get('L')) : Infinity
    if (Number.isNaN(maxDepth) || maxDepth < 1) return usage(ctx, 'invalid level, must be greater than 0')
    const root = a.operands[0] ?? '.'
    const vfs = ctx.shell.vfs
    const abs = ctx.shell.resolve(root)
    try {
      if (vfs.lookup(abs).type !== 'dir') throw new FsError('ENOTDIR', abs)
    } catch (e) {
      return fail(ctx, `${root}: ${(e as FsError).message}`)
    }
    let dirs = 0
    let files = 0
    outln(ctx, pathSegment(ctx, root, vfs.stat(abs)))
    const walk = (dir: string, shownDir: string, prefix: string, depth: number): void => {
      let names: string[]
      try {
        names = vfs.list(dir)
      } catch {
        return
      }
      if (!a.flags.has('a')) names = names.filter((n) => !n.startsWith('.'))
      if (a.flags.has('d')) names = names.filter((n) => vfs.isDir(joinPath(dir, n)))
      names.forEach((name, i) => {
        const lastOne = i === names.length - 1
        const child = joinPath(dir, name)
        const node = vfs.stat(child)!
        const shown = shownDir === '.' ? name : `${shownDir.replace(/\/$/, '')}/${name}`
        outln(ctx, dim(prefix + (lastOne ? '└── ' : '├── ')), pathSegment(ctx, shown, node, name))
        if (node.type === 'dir') {
          dirs++
          if (depth < maxDepth) walk(child, shown, prefix + (lastOne ? '    ' : '│   '), depth + 1)
        } else files++
      })
    }
    walk(abs, root, '', 1)
    outln(ctx)
    outln(ctx, dim(`${dirs} ${dirs === 1 ? 'directory' : 'directories'}${a.flags.has('d') ? '' : `, ${files} ${files === 1 ? 'file' : 'files'}`}`))
    return 0
  },
}

const find: CommandDef = {
  name: 'find',
  summary: 'search for files by name or type',
  kind: 'bin',
  group: 'files',
  flags: {
    '-name': 'match the file name against a glob (quote it!)',
    '-iname': 'like -name, ignoring case',
    '-type': 'f for files, d for directories',
    '-maxdepth': 'how deep to look',
  },
  valueFlags: ['-name', '-iname', '-type', '-maxdepth'],
  operands: [{ kind: 'dir', label: 'where to start searching' }],
  describe: (args) => {
    const i = args.findIndex((a) => a === '-name' || a === '-iname')
    const where = args.filter((a, idx) => !a.startsWith('-') && (idx === 0 || !args[idx - 1].startsWith('-')))[0] ?? '.'
    return i >= 0 && args[i + 1]
      ? `find walks ${where} and everything below it, printing paths whose name matches ${args[i + 1]}.`
      : `find walks ${where} and prints every path below it.`
  },
  man: {
    synopsis: ['find [DIR...] [-name GLOB] [-iname GLOB] [-type f|d] [-maxdepth N]'],
    description: [
      'Walk each directory tree (default: .) and print the paths that match every test you give.',
      'Quote the glob in -name, or the shell expands it first: find . -name "*.md", not find . -name *.md.',
    ],
    options: [
      ['-name GLOB', 'file name matches GLOB (*, ?, [abc])'],
      ['-iname GLOB', 'the same, ignoring case'],
      ['-type f|d', 'only files, or only directories'],
      ['-maxdepth N', 'descend at most N levels'],
    ],
    examples: [
      ['find . -name "*.md"', 'every markdown file under here'],
      ['find / -type d', 'every directory'],
      ['find ~ -iname "*EDDY*"', 'case-insensitive'],
    ],
    seeAlso: ['ls', 'tree', 'grep'],
  },
  run(ctx) {
    const roots: string[] = []
    const tests: { kind: 'name' | 'iname' | 'type'; value: string }[] = []
    let maxDepth = Infinity
    const args = ctx.args
    let i = 0
    while (i < args.length && !args[i].startsWith('-')) roots.push(args[i++])
    for (; i < args.length; i++) {
      const a = args[i]
      const v = args[i + 1]
      if (a === '-name' || a === '-iname' || a === '-type' || a === '-maxdepth') {
        if (v === undefined) return usage(ctx, `missing argument to '${a}'`)
        i++
        if (a === '-maxdepth') {
          maxDepth = Number(v)
          if (Number.isNaN(maxDepth)) return usage(ctx, `invalid -maxdepth '${v}'`)
        } else if (a === '-type') {
          if (v !== 'f' && v !== 'd') return usage(ctx, `unknown type '${v}' (use f or d)`)
          tests.push({ kind: 'type', value: v })
        } else tests.push({ kind: a.slice(1) as 'name' | 'iname', value: v })
      } else if (a === '-print') {
        continue
      } else {
        return usage(ctx, `unknown predicate '${a}'`)
      }
    }
    if (!roots.length) roots.push('.')
    const vfs = ctx.shell.vfs
    let status = 0
    for (const root of roots) {
      const abs = ctx.shell.resolve(root)
      let paths: string[]
      try {
        paths = vfs.walk(abs)
      } catch (e) {
        status = fail(ctx, `'${root}': ${(e as FsError).message}`)
        continue
      }
      for (const p of paths) {
        const rel = p === abs ? '' : p.slice(abs === '/' ? 1 : abs.length + 1)
        const depth = rel ? rel.split('/').length : 0
        if (depth > maxDepth) continue
        const node = vfs.stat(p)!
        const name = basename(p)
        const ok = tests.every((t) =>
          t.kind === 'type' ? (t.value === 'd') === (node.type === 'dir') : matchGlob(name, t.value, t.kind === 'iname'),
        )
        if (!ok) continue
        const shown = rel ? (root.endsWith('/') ? root + rel : `${root}/${rel}`) : root
        outln(ctx, pathSegment(ctx, shown, node))
      }
    }
    return status
  },
}

const touch: CommandDef = {
  name: 'touch',
  summary: 'create an empty file (or update its time)',
  kind: 'bin',
  group: 'files',
  operands: [{ kind: 'path', label: 'file to create' }],
  describe: (args) => `touch creates ${args.join(', ') || 'a file'} if it does not exist, or updates its modification time if it does.`,
  man: {
    synopsis: ['touch FILE...'],
    description: [
      "Create each FILE as an empty file, or update its modification time if it exists. You can only create files where you have write permission: /tmp, not Raj's directories.",
    ],
    examples: [
      ['touch /tmp/notes.txt', 'make an empty file'],
      ['ls -l /tmp', 'see it, owned by guest'],
    ],
    seeAlso: ['mkdir', 'rm', 'ls'],
  },
  run(ctx) {
    if (!ctx.args.length) return fail(ctx, 'missing file operand')
    let status = 0
    for (const f of ctx.args) {
      try {
        ctx.shell.vfs.touch(ctx.shell.resolve(f))
      } catch (e) {
        status = fsFail(ctx, f, e, 'cannot touch')
      }
    }
    return status
  },
}

const mkdir: CommandDef = {
  name: 'mkdir',
  summary: 'make directories',
  kind: 'bin',
  group: 'files',
  flags: { '-p': 'make parent directories as needed; no error if it exists' },
  operands: [{ kind: 'path', label: 'directory to create' }],
  describe: (args) => `mkdir creates the directory ${args.filter((a) => !a.startsWith('-')).join(', ')}.`,
  man: {
    synopsis: ['mkdir [-p] DIR...'],
    description: ['Create directories. Like every write, this only works where you have permission, such as /tmp.'],
    options: [['-p', 'create missing parent directories too, and do not complain if it already exists']],
    examples: [
      ['mkdir /tmp/work', 'a directory of your own'],
      ['mkdir -p /tmp/a/b/c', 'several levels at once'],
    ],
    seeAlso: ['rm', 'touch', 'cd'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'pv' })
    if (a.error) return usage(ctx, a.error)
    if (!a.operands.length) return fail(ctx, 'missing operand')
    let status = 0
    for (const d of a.operands) {
      try {
        ctx.shell.vfs.mkdir(ctx.shell.resolve(d), { parents: a.flags.has('p') })
      } catch (e) {
        status = fsFail(ctx, d, e, 'cannot create directory')
      }
    }
    return status
  },
}

const rm: CommandDef = {
  name: 'rm',
  summary: 'remove files or directories',
  kind: 'bin',
  group: 'files',
  flags: { '-r': 'recursive: remove directories and their contents', '-f': 'force: ignore missing files', '-R': 'same as -r' },
  operands: [{ kind: 'path', label: 'file to remove' }],
  describe: (args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    return `rm deletes ${ops.join(', ') || 'files'}${args.some((a) => /^-\w*[rR]/.test(a)) ? ' and, recursively, everything inside' : ''}. There is no undo.`
  },
  man: {
    synopsis: ['rm [-rf] FILE...'],
    description: [
      "Remove files. There is no trash can and no undo. You can only remove your own files (in /tmp); Raj's are protected by permissions, which is the point of permissions.",
    ],
    options: [
      ['-r, -R', 'remove directories and everything in them'],
      ['-f', 'never ask, ignore files that do not exist'],
    ],
    examples: [
      ['rm /tmp/notes.txt', 'remove one file'],
      ['rm -r /tmp/work', 'remove a directory tree'],
      ['rm resume.md', 'see what permission denied looks like'],
    ],
    seeAlso: ['mkdir', 'touch', 'ls'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'rRfiv', long: ['no-preserve-root', 'recursive', 'force'] })
    if (a.error) return usage(ctx, a.error)
    const recursive = a.flags.has('r') || a.flags.has('R') || a.flags.has('recursive')
    const force = a.flags.has('f') || a.flags.has('force')
    if (!a.operands.length) return force ? 0 : fail(ctx, 'missing operand')
    let status = 0
    for (const f of a.operands) {
      const abs = ctx.shell.resolve(f)
      if (abs === '/' && recursive) {
        fail(ctx, "it is dangerous to operate recursively on '/'")
        fail(ctx, 'use --no-preserve-root to override this failsafe')
        writeln(ctx.stderr, dim("(Even then, Raj's files are read-only. Nice try.)"))
        status = 1
        continue
      }
      try {
        ctx.shell.vfs.lookup(abs)
      } catch (e) {
        if (!force) status = fsFail(ctx, f, e, 'cannot remove')
        continue
      }
      let errors: FsError[]
      try {
        errors = ctx.shell.vfs.remove(abs, { recursive })
      } catch (e) {
        status = fsFail(ctx, f, e, 'cannot remove')
        continue
      }
      if (errors.length) {
        status = 1
        const shown = errors.slice(0, 3)
        for (const e of shown) fsFailQuiet(ctx, e.path === abs ? f : ctx.shell.display(e.path), e)
        if (errors.length > shown.length) fail(ctx, `…and ${errors.length - shown.length} more`)
        ctx.shell.explainPermission(ctx.stderr, errors[0].path)
      }
    }
    return status
  },
}

function fsFailQuiet(ctx: CommandContext, shown: string, e: FsError): void {
  fail(ctx, `cannot remove '${shown}': ${e.message}`)
}

function copyInto(ctx: CommandContext, srcAbs: string, dstAbs: string, recursive: boolean, shownSrc: string): number {
  const vfs = ctx.shell.vfs
  const node = vfs.lookup(srcAbs)
  if (node.type === 'dir') {
    if (!recursive) return fail(ctx, `-r not specified; omitting directory '${shownSrc}'`)
    if (dstAbs === srcAbs || dstAbs.startsWith(srcAbs + '/')) return fail(ctx, `cannot copy a directory, '${shownSrc}', into itself`)
    vfs.mkdir(dstAbs, { parents: true })
    let status = 0
    for (const name of vfs.list(srcAbs)) {
      status = copyInto(ctx, joinPath(srcAbs, name), joinPath(dstAbs, name), recursive, `${shownSrc}/${name}`) || status
    }
    return status
  }
  vfs.write(dstAbs, vfs.read(srcAbs))
  return 0
}

const cp: CommandDef = {
  name: 'cp',
  summary: 'copy files',
  kind: 'bin',
  group: 'files',
  flags: { '-r': 'copy directories recursively' },
  operands: [
    { kind: 'path', label: 'source' },
    { kind: 'path', label: 'destination' },
  ],
  describe: (args) => {
    const ops = args.filter((a) => !a.startsWith('-'))
    return ops.length >= 2 ? `cp copies ${ops.slice(0, -1).join(', ')} to ${ops[ops.length - 1]}.` : 'cp copies a file.'
  },
  man: {
    synopsis: ['cp [-r] SOURCE DEST', 'cp [-r] SOURCE... DIRECTORY'],
    description: [
      "Copy files. Reading Raj's files is allowed, so copying one into /tmp gives you your own editable copy.",
    ],
    options: [['-r', 'copy directories and their contents']],
    examples: [
      ['cp resume.md /tmp/', 'your own copy'],
      ['cp -r experience /tmp/jobs', 'a whole directory'],
    ],
    seeAlso: ['mv', 'rm'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'rRfv' })
    if (a.error) return usage(ctx, a.error)
    if (a.operands.length < 2) return fail(ctx, a.operands.length ? `missing destination file operand after '${a.operands[0]}'` : 'missing file operand')
    const recursive = a.flags.has('r') || a.flags.has('R')
    const dest = a.operands[a.operands.length - 1]
    const destAbs = ctx.shell.resolve(dest)
    const destIsDir = ctx.shell.vfs.isDir(destAbs)
    const sources = a.operands.slice(0, -1)
    if (sources.length > 1 && !destIsDir) return fail(ctx, `target '${dest}' is not a directory`)
    let status = 0
    for (const src of sources) {
      const srcAbs = ctx.shell.resolve(src)
      const target = destIsDir ? joinPath(destAbs, basename(srcAbs)) : destAbs
      try {
        status = copyInto(ctx, srcAbs, target, recursive, src) || status
      } catch (e) {
        if (!(e instanceof FsError)) throw e
        status = e.path === srcAbs ? fsFail(ctx, src, e, 'cannot stat') : fsFail(ctx, ctx.shell.display(e.path), e, 'cannot create')
      }
    }
    return status
  },
}

const mv: CommandDef = {
  name: 'mv',
  summary: 'move or rename files',
  kind: 'bin',
  group: 'files',
  operands: [
    { kind: 'path', label: 'source' },
    { kind: 'path', label: 'destination' },
  ],
  describe: (args) => (args.length >= 2 ? `mv moves ${args.slice(0, -1).join(', ')} to ${args[args.length - 1]} (a rename, if it stays in the same directory).` : 'mv moves a file.'),
  man: {
    synopsis: ['mv SOURCE DEST', 'mv SOURCE... DIRECTORY'],
    description: [
      "Move or rename files. Moving takes a file away from its directory, so you can only move your own files. Raj's stay where they are; copy them with cp instead.",
    ],
    examples: [
      ['mv /tmp/a.txt /tmp/b.txt', 'rename'],
      ['mv /tmp/b.txt /tmp/work/', 'move into a directory'],
    ],
    seeAlso: ['cp', 'rm'],
  },
  run(ctx) {
    const a = parseArgs(ctx.args, { bool: 'fvin' })
    if (a.error) return usage(ctx, a.error)
    if (a.operands.length < 2) return fail(ctx, a.operands.length ? `missing destination file operand after '${a.operands[0]}'` : 'missing file operand')
    const dest = a.operands[a.operands.length - 1]
    const destAbs = ctx.shell.resolve(dest)
    const destIsDir = ctx.shell.vfs.isDir(destAbs)
    const sources = a.operands.slice(0, -1)
    if (sources.length > 1 && !destIsDir) return fail(ctx, `target '${dest}' is not a directory`)
    let status = 0
    for (const src of sources) {
      const srcAbs = ctx.shell.resolve(src)
      const target = destIsDir ? joinPath(destAbs, basename(srcAbs)) : destAbs
      try {
        ctx.shell.vfs.rename(srcAbs, target)
      } catch (e) {
        if (!(e instanceof FsError)) throw e
        status = fail(ctx, `cannot move '${src}' to '${ctx.shell.display(target)}': ${e.message}`)
        if (e.code === 'EACCES') {
          ctx.shell.explainPermission(ctx.stderr, e.path)
          writeln(ctx.stderr, dim('To get your own copy, use '), cmd(`cp ${quoteArg(src)} /tmp/`))
        }
      }
    }
    return status
  },
}

export const FILE_COMMANDS: CommandDef[] = [ls, cd, pwd, cat, tree, find, touch, mkdir, rm, cp, mv]
