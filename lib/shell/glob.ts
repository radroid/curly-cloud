/**
 * Filename globbing: `*`, `?` and `[abc]` against the virtual filesystem. Patterns use
 * backslash to mark characters that were quoted (and so must match literally).
 */
import { joinPath, normalizePath, type VFS } from './vfs'

/** True when the pattern has an unescaped glob character. */
export function hasGlob(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '*' || c === '?') return true
    if (c === '[' && pattern.indexOf(']', i + 2) !== -1) return true
  }
  return false
}

/** Remove glob escapes: `a\*b` → `a*b`. */
export function unescapeGlob(pattern: string): string {
  return pattern.replace(/\\(.)/g, '$1')
}

/** Escape glob characters in literal text. */
export function escapeGlob(text: string): string {
  return text.replace(/[\\*?[\]]/g, '\\$&')
}

const REGEX_SPECIAL = /[.+^${}()|\\/]/

/** Compile one path segment's pattern to a RegExp. */
export function globToRegExp(pattern: string, flags = ''): RegExp {
  let re = '^'
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\' && i + 1 < pattern.length) {
      i++
      re += pattern[i].replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '[') {
      const close = pattern.indexOf(']', i + 2)
      if (close === -1) {
        re += '\\['
        continue
      }
      let body = pattern.slice(i + 1, close)
      let negate = false
      if (body[0] === '!' || body[0] === '^') {
        negate = true
        body = body.slice(1)
      }
      re += `[${negate ? '^' : ''}${body.replace(/\\/g, '\\\\').replace(/]/g, '\\]')}]`
      i = close
    } else if (REGEX_SPECIAL.test(c) || c === ']') re += '\\' + c
    else re += c
  }
  return new RegExp(re + '$', flags)
}

/** Match a whole name against a glob (used by `find -name`). */
export function matchGlob(name: string, pattern: string, ignoreCase = false): boolean {
  return globToRegExp(pattern, ignoreCase ? 'i' : '').test(name)
}

/**
 * Expand a pattern against the filesystem. Relative patterns resolve from `cwd` and return
 * relative results, like a real shell. Returns [] when nothing matches.
 */
export function expandGlob(pattern: string, vfs: VFS, cwd: string): string[] {
  const absolute = pattern.startsWith('/')
  const segments = pattern.split('/').filter((s, i) => s !== '' || i === 0)
  if (absolute) segments.shift()
  // Each candidate: [display path as typed, absolute path on disk].
  let candidates: [string, string][] = [[absolute ? '/' : '', absolute ? '/' : normalizePath(cwd)]]
  for (let idx = 0; idx < segments.length; idx++) {
    const segment = segments[idx]
    const last = idx === segments.length - 1
    const next: [string, string][] = []
    for (const [shown, abs] of candidates) {
      const joinShown = (name: string): string => (shown === '' ? name : shown.endsWith('/') ? shown + name : `${shown}/${name}`)
      if (!hasGlob(segment)) {
        const name = unescapeGlob(segment)
        const target = name === '..' || name === '.' ? normalizePath(`${abs}/${name}`) : joinPath(abs, name)
        if (vfs.stat(target) && (last || vfs.isDir(target))) next.push([joinShown(name), target])
        continue
      }
      let names: string[]
      try {
        names = vfs.list(abs)
      } catch {
        continue
      }
      const re = globToRegExp(segment)
      const showHidden = unescapeGlob(segment).startsWith('.')
      for (const name of names) {
        if (name.startsWith('.') && !showHidden) continue
        if (!re.test(name)) continue
        const target = joinPath(abs, name)
        if (!last && !vfs.isDir(target)) continue
        next.push([joinShown(name), target])
      }
    }
    candidates = next
    if (!candidates.length) return []
  }
  return candidates.map(([shown]) => shown).sort((a, b) => a.localeCompare(b, 'en'))
}
