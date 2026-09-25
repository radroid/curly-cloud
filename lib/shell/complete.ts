/**
 * Tab completion: commands and aliases in command position, paths (relative, absolute and ~/),
 * $VARIABLE names, man topics, `open` targets and command-specific values.
 */
import type { Shell } from './shell'
import type { Completion } from './types'
import { joinPath } from './vfs'

const OPS = new Set(['|', '&', ';', '(', ')', '<', '>'])
const COMMAND_ARG = new Set(['which', 'type', 'sudo', 'help', 'command', 'time'])

function unquote(word: string): string {
  return word.replace(/\\(.)/g, '$1').replace(/['"]/g, '')
}

function commonPrefix(items: string[]): string {
  if (!items.length) return ''
  let p = items[0]
  for (const s of items) while (!s.startsWith(p)) p = p.slice(0, -1)
  return p
}

interface Scan {
  /** The partial word under the cursor, as typed. */
  word: string
  /** Earlier words of the current simple command (a '>' marker means "after a redirect"). */
  prev: string[]
}

function scan(before: string): Scan {
  let prev: string[] = []
  let cur = ''
  let inS = false
  let inD = false
  for (let i = 0; i < before.length; i++) {
    const c = before[i]
    if (inS) {
      if (c === "'") inS = false
      cur += c
      continue
    }
    if (inD) {
      if (c === '"') inD = false
      cur += c
      continue
    }
    if (c === '\\' && i + 1 < before.length) {
      cur += c + before[++i]
      continue
    }
    if (c === "'") inS = true
    if (c === '"') inD = true
    if (c === ' ' || c === '\t') {
      if (cur) prev.push(cur)
      cur = ''
      continue
    }
    if (OPS.has(c)) {
      if (cur) prev.push(cur)
      cur = ''
      if (c === '<' || c === '>') prev.push('>')
      else prev = []
      continue
    }
    cur += c
  }
  return { word: cur, prev }
}

function completePaths(shell: Shell, word: string, dirsOnly: boolean): { full: string; display: string }[] {
  const typed = unquote(word)
  const slash = typed.lastIndexOf('/')
  const dirPart = slash >= 0 ? typed.slice(0, slash + 1) : ''
  const namePart = typed.slice(slash + 1)
  let dirExpanded = dirPart
  if (dirPart === '~/' || dirPart.startsWith('~/')) dirExpanded = shell.home + dirPart.slice(1)
  const dirAbs = shell.resolve(dirExpanded || '.')
  if (namePart === '..' || namePart === '.') return [{ full: `${dirPart}${namePart}/`, display: `${namePart}/` }]
  let names: string[]
  try {
    names = shell.vfs.list(dirAbs)
  } catch {
    return []
  }
  const out: { full: string; display: string }[] = []
  for (const name of names) {
    if (!name.startsWith(namePart)) continue
    if (name.startsWith('.') && !namePart.startsWith('.')) continue
    const isDir = shell.vfs.isDir(joinPath(dirAbs, name))
    if (dirsOnly && !isDir) continue
    out.push({ full: dirPart + name + (isDir ? '/' : ''), display: name + (isDir ? '/' : '') })
  }
  return out
}

export function completeLine(shell: Shell, line: string, cursor: number): Completion {
  const before = line.slice(0, cursor)
  const { word, prev } = scan(before)
  const start = cursor - word.length
  const none: Completion = { start, end: cursor, text: null, options: [] }

  let candidates: { full: string; display: string }[] = []
  const effective = [...prev]
  while (effective.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(effective[0])) effective.shift()
  const afterRedirect = prev[prev.length - 1] === '>'

  if (word.startsWith('$')) {
    const braced = word.startsWith('${')
    const partial = word.slice(braced ? 2 : 1)
    const names = Object.keys(shell.allVars()).filter((n) => n.startsWith(partial)).sort()
    candidates = names.map((n) => ({ full: braced ? `\${${n}}` : `$${n}`, display: `$${n}` }))
  } else if (afterRedirect) {
    candidates = completePaths(shell, word, false)
  } else if (!effective.length) {
    if (word.includes('/')) candidates = completePaths(shell, word, false)
    else {
      const names = new Set([...shell.commandDefs().map((d) => d.name), ...shell.aliases.keys()])
      candidates = [...names]
        .filter((n) => n.startsWith(unquote(word)) && n !== '.')
        .sort()
        .map((n) => ({ full: n, display: n }))
    }
  } else {
    const name = effective[0]
    const argIndex = effective.length - 1
    const def = shell.command(name)
    let values: string[] | null = null
    if (COMMAND_ARG.has(name) && argIndex === 0) values = shell.commandDefs().filter((d) => !d.hidden).map((d) => d.name)
    else if (def?.complete) values = def.complete(shell, argIndex, effective.slice(1))
    if (values) {
      const typed = unquote(word)
      candidates = [...new Set(values)]
        .filter((v) => v.startsWith(typed))
        .sort()
        .map((v) => ({ full: v, display: v }))
      // Fall back to paths when a command's own values don't match (e.g. `open resume.md`).
      if (!candidates.length && name !== 'man' && name !== 'learn') candidates = completePaths(shell, word, false)
    } else candidates = completePaths(shell, word, name === 'cd' || name === 'pushd')
  }

  if (!candidates.length) return none
  if (candidates.length === 1) {
    const only = candidates[0].full
    return { start, end: cursor, text: only.endsWith('/') ? only : `${only} `, options: [] }
  }
  const prefix = commonPrefix(candidates.map((c) => c.full))
  const options = candidates.map((c) => c.display)
  return { start, end: cursor, text: prefix.length > word.length ? prefix : null, options }
}
