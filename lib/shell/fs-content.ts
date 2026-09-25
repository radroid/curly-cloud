/**
 * Raj's files: the read-only base tree of the virtual filesystem, generated from RESUME so the
 * terminal never drifts from the website. Everything here is public resume content.
 */
import { RESUME, resumeMarkdown, type ResumeData } from '@/content/resume'
import type { VNode } from './vfs'

export const HOME = '/home/raj'
export const HOSTNAME = 'curlycloud'
/** Base files show this modification time (the date the terminal shipped). */
export const BASE_MTIME = Date.UTC(2026, 8, 25, 9, 0)

export interface BinEntry {
  name: string
  dir: '/bin' | '/usr/local/bin'
  summary: string
}

export function companySlug(company: string): string {
  return company
    .replace(/\(.*?\)/g, '')
    .replace(/\b(inc|llc|ltd)\b\.?/gi, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Double-quote a value for a shell script. */
export function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`
}

function currentRole(data: ResumeData): ResumeData['experience'][number] | undefined {
  return data.experience.find((r) => r.end === null) ?? data.experience[0]
}

export function profileScript(data: ResumeData = RESUME): string {
  const now = currentRole(data)
  const site = data.links.find((l) => /curlycloud/i.test(l.label))?.href ?? 'https://curlycloud.dev'
  return [
    '# ~/.profile: runs every time you log in (rsh sources it at startup).',
    '#',
    '# Before this file ran, login already set USER, HOME, SHELL, TERM and PATH.',
    '# `export NAME=value` puts a variable in the environment, so every program you',
    '# run inherits it. Compare `env` (exported only) with `set` (everything).',
    '',
    '# Find Raj\'s own tools (resume, ask, fit, learn…) in /usr/local/bin first.',
    'export PATH="/usr/local/bin:$PATH"',
    'export EDITOR=nano',
    'export LANG=en_CA.UTF-8',
    '',
    '# About the owner of this home directory.',
    `export RAJ_ROLE=${shellQuote(data.role)}`,
    ...(now ? [`export RAJ_COMPANY=${shellQuote(now.company)}`] : []),
    `export RAJ_LOCATION=${shellQuote(data.location)}`,
    `export RAJ_EMAIL=${shellQuote(data.email)}`,
    `export RAJ_SITE=${shellQuote(site)}`,
    '',
    '# A plain shell variable: no export, so it shows in `set` but not in `env`.',
    "RAJ_MOTTO='design for reliability first'",
    '',
    '# Aliases are shortcuts for longer commands. Type `alias` to list them.',
    "alias ll='ls -la'",
    "alias la='ls -a'",
    "alias ..='cd ..'",
    '',
    '# The prompt. \\u = user, \\h = host, \\w = working directory, \\$ = $ (# for root).',
    "# Try: PS1='\\W > '",
    "PS1='\\u@\\h:\\w\\$ '",
    '',
  ].join('\n')
}

function readme(data: ResumeData): string {
  return [
    `# Welcome to ${data.name.split(' ')[0]}'s home directory`,
    '',
    `You're logged in as guest on ${HOSTNAME}, a small Unix-style shell that runs in`,
    `your browser. Everything in here is ${data.name}'s public resume, laid out as files.`,
    '',
    '## Start here',
    '',
    '    ls                   list what is in this directory',
    '    cat about.txt        print a file',
    '    cd experience        move into a directory (cd .. goes back up)',
    '    learn                a hands-on tutorial: navigation to pipes to exit codes',
    '    ask "..."            ask Raj\'s AI clone a question',
    '    explain \'ls -la\'     break any command line down, piece by piece',
    '    help                 every command, grouped',
    '',
    '## What is here',
    '',
    '    about.txt            who Raj is, in a few paragraphs',
    '    resume.md            the whole resume',
    '    contact.txt          how to reach him',
    '    education.md         degrees and certificates',
    '    experience/          one file per role',
    '    builds/              independent projects',
    '    skills/              skills by area',
    '    .profile             where your environment variables come from (ls -a)',
    '',
    '## Your files',
    '',
    "Raj's files are read-only (see ls -l). /tmp is yours: anything you write there",
    'is saved in this browser until you run `reset`.',
    '',
  ].join('\n')
}

function about(data: ResumeData): string {
  const now = currentRole(data)
  return [
    data.name,
    `${data.role} · ${data.location}`,
    '',
    data.headline,
    '',
    data.pitch,
    '',
    ...data.summary.flatMap((p) => [p, '']),
    ...(now ? [`Now: ${now.role} at ${now.company} (${now.period}).`, ''] : []),
    'More: cat resume.md · ls experience · ask "what are you building now?"',
    '',
  ].join('\n')
}

function contact(data: ResumeData): string {
  const width = Math.max(5, ...data.links.map((l) => l.label.length)) + 2
  return [
    data.name,
    data.location,
    '',
    `${'email'.padEnd(width)}${data.email}`,
    ...data.links.map((l) => `${l.label.padEnd(width)}${l.href}`),
    '',
    'Try: open email · open linkedin · open github',
    '',
  ].join('\n')
}

function roleFile(role: ResumeData['experience'][number]): string {
  return [
    `# ${role.role}, ${role.company}`,
    `${role.location} · ${role.period}`,
    '',
    ...(role.blurb ? [role.blurb, ''] : []),
    ...role.bullets.map((b) => `- ${b.text}`),
    '',
  ].join('\n')
}

function buildFile(build: ResumeData['builds'][number]): string {
  return [`# ${build.title}`, `${build.period} · ${build.stack.join(', ')}`, '', ...build.bullets.map((b) => `- ${b.text}`), ''].join('\n')
}

function skillFile(group: ResumeData['skills'][number]): string {
  return [group.label, '', ...group.items.map((i) => i.label), ''].join('\n')
}

function education(data: ResumeData): string {
  return ['# Education', '', ...data.education.map((e) => `- ${e.credential}, ${e.school} (${e.period})`), ''].join('\n')
}

function motd(data: ResumeData): string {
  return [
    `Welcome to ${HOSTNAME}: ${data.name}'s resume, as a shell.`,
    `${data.role} · ${data.location}. ${data.headline}`,
    '',
  ].join('\n')
}

const SECRETS = [
  '# If you can read this, the permission system is broken.',
  '# (It is not. This file is mode 400: only raj can read it.)',
  '',
].join('\n')

/** Build the base tree. `bins` become executables in /bin and /usr/local/bin. */
export function buildBaseTree(bins: BinEntry[], data: ResumeData = RESUME): Map<string, VNode> {
  const tree = new Map<string, VNode>()
  const dir = (path: string, owner: VNode['owner'] = 'root', mode = 0o755): void => {
    tree.set(path, { type: 'dir', owner, mode, mtime: BASE_MTIME })
  }
  const file = (path: string, content: string, owner: VNode['owner'] = 'raj', mode = 0o644): void => {
    tree.set(path, { type: 'file', owner, mode, content, mtime: BASE_MTIME })
  }

  dir('/')
  for (const d of ['/bin', '/etc', '/home', '/usr', '/usr/local', '/usr/local/bin', '/dev']) dir(d)
  dir('/tmp', 'root', 0o1777)
  file('/dev/null', '', 'root', 0o666)

  file('/etc/motd', motd(data), 'root')
  file('/etc/hostname', `${HOSTNAME}\n`, 'root')
  file('/etc/shells', '/bin/rsh\n', 'root')
  file(
    '/etc/passwd',
    [
      'root:x:0:0:root:/root:/bin/rsh',
      `raj:x:1000:1000:${data.name}:${HOME}:/bin/rsh`,
      `guest:x:1001:1001:Visitor:${HOME}:/bin/rsh`,
      '',
    ].join('\n'),
    'root',
  )

  file('/bin/rsh', '#!/bin/rsh\n# rsh: the shell you are using right now. See: man rsh\n', 'root', 0o755)
  for (const b of bins) {
    file(`${b.dir}/${b.name}`, `#!/bin/rsh\n# ${b.name}: ${b.summary}\n# Built into this terminal. Read the manual: man ${b.name}\n`, 'root', 0o755)
  }

  dir(HOME, 'raj')
  file(`${HOME}/README.md`, readme(data))
  file(`${HOME}/about.txt`, about(data))
  file(`${HOME}/resume.md`, resumeMarkdown(data))
  file(`${HOME}/contact.txt`, contact(data))
  file(`${HOME}/education.md`, education(data))
  file(`${HOME}/.profile`, profileScript(data))
  file(`${HOME}/.secrets`, SECRETS, 'raj', 0o400)

  dir(`${HOME}/experience`, 'raj')
  for (const role of data.experience) file(`${HOME}/experience/${companySlug(role.company)}.md`, roleFile(role))
  dir(`${HOME}/builds`, 'raj')
  for (const build of data.builds) file(`${HOME}/builds/${build.id}.md`, buildFile(build))
  dir(`${HOME}/skills`, 'raj')
  for (const group of data.skills) file(`${HOME}/skills/${group.id}.txt`, skillFile(group))

  return tree
}
