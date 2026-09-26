/**
 * `learn`: a guided tutorial. Each step states a goal, checks what the visitor actually typed
 * (the parsed line, the commands that ran, their exit codes, output and the shell's state),
 * hints on a wrong attempt, and celebrates completion. Progress persists.
 */
import { HOME } from './fs-content'
import { pipelines, simpleCommands, type List } from './parser'
import { accent, cmd, dim, hi, seg, strong, writeln, type Printable } from './output'
import type { Shell, TraceEntry } from './shell'
import type { Sink } from './types'

export interface LearnState {
  /** Active lesson index, or null when paused / not started. */
  lesson: number | null
  step: number
  /** Completed lesson indexes. */
  done: number[]
  /** Per-lesson scratch, e.g. the variable name the visitor chose. */
  data: Record<string, string>
}

export interface LearnInput {
  line: string
  list: List | null
  status: number
  output: string
  trace: TraceEntry[]
}

interface Step {
  goal(state: LearnState): Printable[]
  check(input: LearnInput, shell: Shell, state: LearnState): boolean
  /** Did the visitor try this step (so a hint is useful) rather than wander off? */
  attempted?(input: LearnInput, state: LearnState): boolean
  hint(input: LearnInput, state: LearnState): Printable[]
  success(input: LearnInput, shell: Shell, state: LearnState): Printable[]
}

interface Lesson {
  id: string
  title: string
  intro: string
  steps: Step[]
}

export function emptyLearn(): LearnState {
  return { lesson: null, step: 0, done: [], data: {} }
}

export function sanitizeLearn(value: unknown): LearnState {
  const v = (value ?? {}) as Partial<LearnState>
  const lesson = typeof v.lesson === 'number' && v.lesson >= 0 && v.lesson < LESSONS.length ? v.lesson : null
  const step = typeof v.step === 'number' && v.step >= 0 && lesson !== null && v.step < LESSONS[lesson].steps.length ? v.step : 0
  const done = Array.isArray(v.done) ? [...new Set(v.done.filter((n): n is number => typeof n === 'number' && n >= 0 && n < LESSONS.length))] : []
  const data: Record<string, string> = {}
  if (v.data && typeof v.data === 'object') for (const [k, x] of Object.entries(v.data)) if (typeof x === 'string') data[k] = x
  return { lesson, step, done, data }
}

// ── Helpers for checks ───────────────────────────────────────────────────────

const code = (line: string): Printable => cmd(line, line, 'highlight')
const ran = (i: LearnInput, name: string): TraceEntry[] => i.trace.filter((t) => t.name === name)
const ranOk = (i: LearnInput, name: string): boolean => ran(i, name).some((t) => t.status === 0)
const usedAny = (i: LearnInput, ...names: string[]): boolean => i.trace.some((t) => names.includes(t.name))

function words(i: LearnInput): ReturnType<typeof simpleCommands>[number]['words'] {
  return i.list ? simpleCommands(i.list).flatMap((c) => c.words) : []
}

function hasOp(i: LearnInput, op: '&&' | '||'): boolean {
  return !!i.list && i.list.items.some((it) => it.andOr.rest.some((r) => r.op === op))
}

function varName(state: LearnState): string {
  return state.data.var ?? 'NAME'
}

// ── Lessons ──────────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [
  {
    id: 'navigation',
    title: 'Finding your way',
    intro: 'A shell always has a working directory: the folder you are in right now. Everything else is relative to it.',
    steps: [
      {
        goal: () => ['Print where you are with ', code('pwd'), dim(' (print working directory).')],
        check: (i) => ranOk(i, 'pwd'),
        attempted: (i) => usedAny(i, 'pwd', 'cd', 'ls'),
        hint: () => ['Type ', code('pwd'), ' and press Enter.'],
        success: () => ['That is your working directory, /home/raj. ', hi('~'), ' is shorthand for it, and the prompt shows it too.'],
      },
      {
        goal: () => ['List what is here with ', code('ls'), '.'],
        check: (i) => ranOk(i, 'ls'),
        attempted: (i) => usedAny(i, 'ls', 'dir'),
        hint: () => ['Just ', code('ls'), '. It lists the current directory.'],
        success: () => ['The coloured names are directories (click one to go in); the rest are files.'],
      },
      {
        goal: () => ['Move into the experience directory: ', code('cd experience'), dim(' (Tab completes names).')],
        check: (_i, shell) => shell.cwd === `${HOME}/experience`,
        attempted: (i) => usedAny(i, 'cd'),
        hint: (i) =>
          ran(i, 'cd').some((t) => t.status !== 0)
            ? ['cd could not find that directory. Check the spelling (Tab completes names), or go home first with ', code('cd ~'), '.']
            : ['Type ', code('cd experience'), '.'],
        success: () => ['The prompt now says ~/experience. Relative names like aro.md are looked up here now; try ', code('ls'), ' later.'],
      },
      {
        goal: () => ['Go back up one level: ', code('cd ..')],
        check: (i, shell) => usedAny(i, 'cd', '..') && shell.cwd === HOME,
        attempted: (i) => usedAny(i, 'cd'),
        hint: () => [code('..'), ' means the parent directory. From ~/experience, ', code('cd ..'), ' goes home.'],
        success: () => [hi('..'), ' is the parent directory. ', code('cd'), ' alone always goes home, and ', code('cd -'), ' jumps back to where you were.'],
      },
    ],
  },
  {
    id: 'reading',
    title: 'Reading files',
    intro: 'Files hold text. A handful of small commands read them in different ways.',
    steps: [
      {
        goal: () => ['Print a whole file: ', code('cat about.txt'), '.'],
        check: (i) => ran(i, 'cat').some((t) => t.status === 0 && t.args.some((a) => a.endsWith('about.txt'))),
        attempted: (i) => usedAny(i, 'cat'),
        hint: (i) =>
          ran(i, 'cat').some((t) => t.status !== 0)
            ? ['cat could not find it from here. Try ', code('cat ~/about.txt'), '.']
            : ['Type ', code('cat about.txt'), '.'],
        success: () => ['cat prints files (it is short for concatenate: give it several and it joins them).'],
      },
      {
        goal: () => ['Read just the top of a long file: ', code('head -n 5 resume.md'), '.'],
        check: (i) => [...ran(i, 'head'), ...ran(i, 'tail')].some((t) => t.status === 0),
        attempted: (i) => usedAny(i, 'head', 'tail', 'cat'),
        hint: () => ['Try ', code('head -n 5 resume.md'), '. -n says how many lines.'],
        success: () => ['head shows the top, tail the bottom. -n picks how many lines.'],
      },
      {
        goal: () => ['Some files are hidden: their names start with a dot. Show them with ', code('ls -a'), '.'],
        check: (i) => ran(i, 'ls').some((t) => t.status === 0 && t.args.some((a) => /^-\w*[aA]/.test(a))),
        attempted: (i) => usedAny(i, 'ls'),
        hint: () => ['ls needs the -a flag (for all): ', code('ls -a'), '.'],
        success: () => ['Now you can see .profile and .secrets. (Try ', code('cat .secrets'), ' some time.)'],
      },
      {
        goal: () => ['Read the hidden login script: ', code('cat .profile'), '.'],
        check: (i) => ran(i, 'cat').some((t) => t.status === 0 && t.args.some((a) => a.endsWith('.profile'))),
        attempted: (i) => usedAny(i, 'cat', 'less', 'more'),
        hint: () => ['Type ', code('cat .profile'), ' (from your home directory).'],
        success: () => ['Those ', hi('export'), ' lines ran when you logged in. That is where $RAJ_ROLE and friends come from. Next: variables.'],
      },
    ],
  },
  {
    id: 'variables',
    title: 'Variables and export',
    intro: 'Variables are named bits of text. Some are private to the shell; exported ones are handed to every program you run.',
    steps: [
      {
        goal: () => ['Print a variable: ', code('echo $USER'), '.'],
        check: (i) => ranOk(i, 'echo') && /\$\{?USER\}?/.test(i.line),
        attempted: (i) => usedAny(i, 'echo', 'printenv'),
        hint: () => ['Put a $ in front of the name to read it: ', code('echo $USER'), '.'],
        success: () => ['The shell swapped $USER for its value before echo ran. echo never saw the $.'],
      },
      {
        goal: () => ['Make your own, with no spaces around the =: ', code('NAME=yourname'), '.'],
        check: (i, _s, state) => {
          const t = i.trace.find((x) => x.name === '' && x.assigns.length)
          if (!t) return false
          state.data.var = t.assigns[0]
          return true
        },
        attempted: (i) => i.line.includes('='),
        hint: (i) =>
          /^\s*[A-Za-z_]\w*\s+=/.test(i.line) || /^\s*[A-Za-z_]\w*=\s+\S/.test(i.line)
            ? ['No spaces around =. With a space, the shell thinks the name is a command to run. Try ', code('NAME=yourname'), '.']
            : ['Type ', code('NAME=yourname'), ' (any name and value work).'],
        success: (_i, _s, state) => [hi(varName(state)), ' is now a shell variable. Check it with ', code(`echo $${varName(state)}`), ' whenever you like.'],
      },
      {
        goal: (state) => ['Look for it in the environment: ', code(`env | grep ${varName(state)}`), '.'],
        check: (i) => usedAny(i, 'env', 'printenv'),
        attempted: (i) => usedAny(i, 'grep', 'set'),
        hint: (_i, state) => ['env prints the environment; grep filters it: ', code(`env | grep ${varName(state)}`), '.'],
        success: (_i, shell, state) =>
          shell.isExported(varName(state))
            ? ['You exported it already, so it is there. Programs you run inherit it.']
            : ['Nothing! ', hi(varName(state)), ' is a shell variable: only this shell sees it. Programs you run get the environment, and it is not in there yet.'],
      },
      {
        goal: (state) => ['Export it: ', code(`export ${varName(state)}`), '.'],
        check: (_i, shell, state) => shell.isExported(varName(state)) && shell.hasVar(varName(state)),
        attempted: (i) => usedAny(i, 'export'),
        hint: (_i, state) => [code(`export ${varName(state)}`), ' (no $: you are naming the variable, not reading it).'],
        success: () => ['Now it is in the environment, inherited by every program you start. (Here, exported variables are also saved for your next visit.)'],
      },
      {
        goal: (state) => ['Check again: ', code(`env | grep ${varName(state)}`), '.'],
        check: (i, _s, state) => usedAny(i, 'env', 'printenv') && i.output.includes(`${varName(state)}=`),
        attempted: (i) => usedAny(i, 'env', 'printenv', 'grep'),
        hint: (_i, state) => ['Run ', code(`env | grep ${varName(state)}`), '.'],
        success: () => ['There it is. ', code('set'), ' shows every variable; ', code('env'), ' shows only exported ones. Compare them some time.'],
      },
    ],
  },
  {
    id: 'quoting',
    title: 'Quoting',
    intro: 'The shell rewrites your line before running it: it splits on spaces and expands $variables and *globs. Quotes control that.',
    steps: [
      {
        goal: () => ['Double quotes still expand variables: ', code('echo "I am $USER"'), '.'],
        check: (i) => ranOk(i, 'echo') && words(i).some((w) => w.parts.some((p) => p.type === 'param' && p.quoted)),
        attempted: (i) => usedAny(i, 'echo'),
        hint: () => ['Wrap it in double quotes, with a $variable inside: ', code('echo "I am $USER"'), '.'],
        success: () => ['Double quotes make one argument out of several words, and $variables still expand inside.'],
      },
      {
        goal: () => ['Single quotes are literal: ', code("echo 'I am $USER'"), '.'],
        check: (i) => ranOk(i, 'echo') && words(i).some((w) => w.parts.some((p) => p.type === 'text' && p.quote === 'single' && p.text.includes('$'))),
        attempted: (i) => usedAny(i, 'echo'),
        hint: () => ['Use single quotes around text with a $ in it: ', code("echo 'I am $USER'"), '.'],
        success: () => ['Inside single quotes nothing expands. Use them when you mean exactly what you typed.'],
      },
      {
        goal: () => ['Quotes keep spaces: ', code('echo "a    b"'), dim(' (then compare echo a    b).')],
        check: (i) => ran(i, 'echo').some((t) => t.status === 0 && t.args.some((a) => / {2,}/.test(a))),
        attempted: (i) => usedAny(i, 'echo'),
        hint: () => ['Put several spaces between two words, inside quotes: ', code('echo "a    b"'), '.'],
        success: () => ['Unquoted, the shell splits on spaces and echo receives separate words, joined by one space. Quoted, the spaces are part of the argument.'],
      },
      {
        goal: () => ['Escape a single character with a backslash: ', code('echo \\$HOME'), '.'],
        check: (i) => ranOk(i, 'echo') && words(i).some((w) => w.parts.some((p) => p.type === 'text' && p.quote === 'escape' && p.text.includes('$'))),
        attempted: (i) => usedAny(i, 'echo'),
        hint: () => ['Put a backslash right before the $: ', code('echo \\$HOME'), '.'],
        success: () => ['A backslash makes the next character literal. Handy for one character; quotes for more.'],
      },
    ],
  },
  {
    id: 'pipes',
    title: 'Pipes and redirects',
    intro: 'Small programs do one thing each. Pipes chain them together; redirects connect them to files.',
    steps: [
      {
        goal: () => ['Send one command’s output into another: ', code('cat resume.md | grep -i mcp'), '.'],
        check: (i) => !!i.list && pipelines(i.list).some((p) => p.commands.length > 1) && usedAny(i, 'grep'),
        attempted: (i) => usedAny(i, 'grep', 'cat'),
        hint: () => ['The | goes between the two commands: ', code('cat resume.md | grep -i mcp'), '.'],
        success: () => [hi('|'), ' connects the output (stdout) of cat to the input (stdin) of grep. grep keeps the matching lines.'],
      },
      {
        goal: () => ['Count the matches with one more stage: ', code('grep -i mcp resume.md | wc -l'), '.'],
        check: (i) => !!i.list && pipelines(i.list).some((p) => p.commands.length > 1) && usedAny(i, 'wc'),
        attempted: (i) => usedAny(i, 'wc', 'grep'),
        hint: () => ['Add ', code('| wc -l'), ' at the end. wc -l counts lines.'],
        success: () => ['Each tool knows nothing about the others. The pipe is what composes them.'],
      },
      {
        goal: () => ['Save output to a file with >. Raj’s files are read-only, but /tmp is yours: ', code('echo hello > /tmp/hello.txt'), '.'],
        check: (i) => i.trace.some((t) => t.status === 0 && t.redirects.some((r) => r.op === '>' && r.fd === 1 && r.path.startsWith('/tmp/'))),
        attempted: (i) => i.trace.some((t) => t.redirects.length > 0),
        hint: (i) =>
          i.trace.some((t) => t.redirects.some((r) => !r.path.startsWith('/tmp/')))
            ? ['You can only write in /tmp here. Try ', code('echo hello > /tmp/hello.txt'), '.']
            : ['Type ', code('echo hello > /tmp/hello.txt'), '.'],
        success: () => [hi('>'), ' sends output to a file instead of the screen, replacing what was in it.'],
      },
      {
        goal: () => ['Append with >>: ', code('echo again >> /tmp/hello.txt'), '.'],
        check: (i) => i.trace.some((t) => t.status === 0 && t.redirects.some((r) => r.op === '>>' && r.path.startsWith('/tmp/'))),
        attempted: (i) => i.trace.some((t) => t.redirects.length > 0),
        hint: () => ['Two > signs: ', code('echo again >> /tmp/hello.txt'), '.'],
        success: () => [hi('>>'), ' adds to the end instead of replacing.'],
      },
      {
        goal: () => ['Read it back: ', code('cat /tmp/hello.txt'), '.'],
        check: (i) => ran(i, 'cat').some((t) => t.status === 0 && t.args.some((a) => a.includes('/tmp/') || a.startsWith('hello'))),
        attempted: (i) => usedAny(i, 'cat'),
        hint: () => ['Type ', code('cat /tmp/hello.txt'), '.'],
        success: () => ['Your own file, owned by guest (see ', code('ls -l /tmp'), '). It will still be here next visit, until you run reset.'],
      },
    ],
  },
  {
    id: 'exit-codes',
    title: 'Exit codes, && and ||',
    intro: 'Every command finishes with a number: 0 means success, anything else means failure. The shell can branch on it.',
    steps: [
      {
        goal: () => ['See an exit code: ', code('false; echo $?'), '.'],
        check: (i) => ranOk(i, 'echo') && /\$\{?\?\}?/.test(i.line),
        attempted: (i) => usedAny(i, 'false', 'true', 'echo'),
        hint: () => [hi('$?'), ' holds the last exit code. Try ', code('false; echo $?'), '.'],
        success: () => ['false always fails with 1; true succeeds with 0. $? holds the exit code of the last command.'],
      },
      {
        goal: () => [hi('&&'), ' runs the next command only if the first succeeded: ', code('cd builds && ls'), '.'],
        check: (i) => hasOp(i, '&&') && i.status === 0 && i.trace.length >= 2,
        attempted: (i) => hasOp(i, '&&') || hasOp(i, '||'),
        hint: () => ['Both commands need to succeed. From home, ', code('cd ~/builds && ls'), ' works.'],
        success: () => ['The ls only ran because cd succeeded. Handy for "do this, then that, but stop on errors".'],
      },
      {
        goal: () => [hi('||'), ' runs the next command only if the first failed: ', code('cat nope.txt || echo "no such file"'), '.'],
        check: (i) => hasOp(i, '||') && i.trace.length >= 2 && i.trace[0].status !== 0 && i.status === 0,
        attempted: (i) => hasOp(i, '||') || hasOp(i, '&&'),
        hint: () => ['The left side has to fail for the right side to run: ', code('cat nope.txt || echo "no such file"'), '.'],
        success: () => [hi('||'), ' is the fallback. Together: ', code('grep -qi kafka resume.md && echo yes || echo no'), '.'],
      },
    ],
  },
  {
    id: 'clone',
    title: 'Talking to the clone',
    intro: 'Raj has an AI clone that answers in his voice from his own words, with sources. It is a command like any other.',
    steps: [
      {
        goal: () => ['Ask it something: ', code('ask "what are you building now?"'), '.'],
        check: (i) => usedAny(i, 'ask'),
        hint: () => ['Quote the question so it arrives as one argument: ', code('ask "what are you building now?"'), '.'],
        success: (i) =>
          ran(i, 'ask').some((t) => t.status === 0)
            ? ['That answer came from the clone, with numbered sources underneath. Plain ', code('ask'), ' starts a conversation.']
            : ['The clone could not answer right now, but that is the command. When it is up, it answers in Raj’s voice with sources.'],
      },
      {
        goal: () => ['Take any command line apart: ', code("explain 'cat *.md | grep -i agent | wc -l'"), '.'],
        check: (i) => ranOk(i, 'explain'),
        attempted: (i) => usedAny(i, 'explain'),
        hint: () => ['Put the whole command line in single quotes after explain.'],
        success: () => ['Use explain whenever a command looks cryptic. It never runs anything.'],
      },
      {
        goal: () => ['AI agents can ask the clone too. See how: ', code('mcp'), '.'],
        check: (i) => ranOk(i, 'mcp'),
        hint: () => ['Type ', code('mcp'), '.'],
        success: () => ['That is how a recruiter’s agent (or yours) can talk to the clone directly.'],
      },
    ],
  },
]

// ── Rendering and progress ───────────────────────────────────────────────────

function stepLine(state: LearnState): Printable[] {
  const lesson = LESSONS[state.lesson!]
  return [accent('→ '), dim(`Step ${state.step + 1}/${lesson.steps.length} · `), ...lesson.steps[state.step].goal(state)]
}

export function startLesson(shell: Shell, index: number, out: Sink): void {
  const state = shell.learn
  state.lesson = index
  state.step = 0
  const lesson = LESSONS[index]
  writeln(out)
  writeln(out, hi(`Lesson ${index + 1}/${LESSONS.length} · ${lesson.title}`))
  writeln(out, dim(lesson.intro))
  writeln(out, stepLine(state))
}

export function showProgress(shell: Shell, out: Sink): void {
  const state = shell.learn
  writeln(out, strong('Learn the shell'), dim(` · ${state.done.length}/${LESSONS.length} lessons done`))
  LESSONS.forEach((l, i) => {
    const mark = state.done.includes(i) ? accent('  ✓ ') : state.lesson === i ? hi('  ▸ ') : dim('    ')
    const extra = state.lesson === i ? dim(`  (step ${state.step + 1}/${l.steps.length})`) : ''
    writeln(out, mark, cmd(`learn ${i + 1}`, `${i + 1}. ${l.title}`, state.done.includes(i) ? 'dim' : 'plain'), extra)
  })
  writeln(out)
  if (state.lesson !== null) writeln(out, stepLine(state))
  writeln(out, dim('Commands: '), cmd('learn next'), dim(' · '), cmd('learn 1', 'learn N'), dim(' · '), cmd('learn stop'), dim(' · '), cmd('learn reset'))
}

function nextLesson(state: LearnState): number | null {
  for (let i = 0; i < LESSONS.length; i++) if (!state.done.includes(i)) return i
  return null
}

function completeLesson(shell: Shell, out: Sink): void {
  const state = shell.learn
  const idx = state.lesson!
  if (!state.done.includes(idx)) state.done.push(idx)
  state.lesson = null
  state.step = 0
  writeln(out)
  writeln(out, hi('★ '), strong(`Lesson ${idx + 1} complete: ${LESSONS[idx].title}.`), dim(` ${state.done.length}/${LESSONS.length} done.`))
  const next = nextLesson(state)
  if (next === null) {
    writeln(out, hi('★ You finished every lesson.'), " You now know more shell than plenty of people who use one every day.")
    writeln(out, dim('Keep going: '), cmd('fit'), dim(' · '), cmd('man rsh'), dim(' · '), cmd('ask'), dim(' · '), cmd('open macintosh'))
    return
  }
  writeln(out, dim('Next up: '), cmd(`learn next`, `learn next`), dim(` → ${LESSONS[next].title}`))
}

/** Called after every interactive command while a lesson is active. */
export function checkLearn(shell: Shell, input: LearnInput, out: Sink): void {
  const state = shell.learn
  if (state.lesson === null) return
  const lesson = LESSONS[state.lesson]
  const step = lesson.steps[state.step]
  if (!step) return
  if (step.check(input, shell, state)) {
    writeln(out, accent('✓ '), ...step.success(input, shell, state))
    state.step++
    if (state.step >= lesson.steps.length) completeLesson(shell, out)
    else writeln(out, stepLine(state))
    return
  }
  const neutral = input.trace.length > 0 && input.trace.every((t) => ['help', 'man', 'clear', 'history', 'learn', 'reset'].includes(t.name))
  const tried = input.list === null || (step.attempted ? step.attempted(input, state) : true)
  if (!neutral && tried) writeln(out, seg('learn: ', 'dim'), dim('not quite. '), ...step.hint(input, state))
}

/** The `learn` command's subcommands. Returns an exit code. */
export function runLearn(shell: Shell, args: string[], out: Sink): number {
  const state = shell.learn
  const sub = args[0]
  if (sub === undefined) {
    if (state.lesson === null && !state.done.length) {
      writeln(out, strong('Learn the shell'), dim(`: ${LESSONS.length} short lessons, about 10 minutes. Type the commands (or click them).`))
      startLesson(shell, 0, out)
      return 0
    }
    showProgress(shell, out)
    return 0
  }
  if (sub === 'reset') {
    shell.learn = emptyLearn()
    writeln(out, dim('Progress cleared. '), cmd('learn'), dim(' to start again.'))
    return 0
  }
  if (sub === 'stop' || sub === 'pause') {
    state.lesson = null
    writeln(out, dim('Paused. Your progress is saved: '), cmd('learn'), dim(' to see it.'))
    return 0
  }
  if (sub === 'next' || sub === 'skip') {
    if (state.lesson !== null) {
      const lesson = LESSONS[state.lesson]
      state.step++
      writeln(out, dim('Skipped that step.'))
      if (state.step >= lesson.steps.length) completeLesson(shell, out)
      else writeln(out, stepLine(state))
      return 0
    }
    const next = nextLesson(state)
    if (next === null) {
      writeln(out, hi('★ '), 'You have finished every lesson. ', cmd('learn reset'), dim(' to start over.'))
      return 0
    }
    startLesson(shell, next, out)
    return 0
  }
  const n = Number(sub)
  if (Number.isInteger(n) && n >= 1 && n <= LESSONS.length) {
    startLesson(shell, n - 1, out)
    return 0
  }
  writeln(out, seg(`learn: unknown option '${sub}'. `, 'error'), dim('Try learn, learn next, learn 1-7, learn stop or learn reset.'))
  return 2
}
