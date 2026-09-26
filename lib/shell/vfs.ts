/**
 * Virtual filesystem: a read-only base tree (Raj's files, built from content/resume.ts) plus a
 * writable overlay for the visitor. Permissions are real Unix semantics seen from `guest`:
 * Raj's and root's files are "other" to you, /tmp is world-writable with the sticky bit.
 */

export type Owner = 'root' | 'raj' | 'guest'

export interface VNode {
  type: 'file' | 'dir'
  owner: Owner
  /** Permission bits, e.g. 0o644, 0o1777 for /tmp. */
  mode: number
  content?: string
  mtime: number
}

export type FsErrorCode = 'ENOENT' | 'ENOTDIR' | 'EISDIR' | 'EACCES' | 'EEXIST' | 'ENOTEMPTY' | 'ENOSPC' | 'EINVAL'

const MESSAGES: Record<FsErrorCode, string> = {
  ENOENT: 'No such file or directory',
  ENOTDIR: 'Not a directory',
  EISDIR: 'Is a directory',
  EACCES: 'Permission denied',
  EEXIST: 'File exists',
  ENOTEMPTY: 'Directory not empty',
  ENOSPC: 'No space left on device',
  EINVAL: 'Invalid argument',
}

export class FsError extends Error {
  constructor(
    readonly code: FsErrorCode,
    readonly path: string,
  ) {
    super(MESSAGES[code])
    this.name = 'FsError'
  }
}

/** Serialized overlay entry (kept short: it lives in localStorage). */
export interface OverlayEntry {
  t: 'f' | 'd'
  c?: string
  m: number
}

/** The overlay is capped so localStorage stays small. */
export const OVERLAY_LIMIT_BYTES = 200_000

// ── Paths ────────────────────────────────────────────────────────────────────

export function normalizePath(path: string): string {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return '/' + out.join('/')
}

export function resolvePath(cwd: string, path: string): string {
  if (!path) return normalizePath(cwd)
  return normalizePath(path.startsWith('/') ? path : `${cwd}/${path}`)
}

export function dirname(path: string): string {
  const p = normalizePath(path)
  if (p === '/') return '/'
  return p.slice(0, p.lastIndexOf('/')) || '/'
}

export function basename(path: string): string {
  const p = normalizePath(path)
  return p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1)
}

export function joinPath(dir: string, name: string): string {
  return dir === '/' ? `/${name}` : `${dir}/${name}`
}

/** `/home/raj/x` → `~/x` when home is /home/raj. */
export function tildify(path: string, home: string): string {
  if (path === home) return '~'
  if (home !== '/' && path.startsWith(home + '/')) return '~' + path.slice(home.length)
  return path
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

// ── Permissions (from guest's point of view) ────────────────────────────────

export function canRead(node: VNode): boolean {
  return node.owner === 'guest' ? (node.mode & 0o400) !== 0 : (node.mode & 0o004) !== 0
}

export function canWrite(node: VNode): boolean {
  return node.owner === 'guest' ? (node.mode & 0o200) !== 0 : (node.mode & 0o002) !== 0
}

/** `drwxr-xr-x`, `-rw-r--r--`, `drwxrwxrwt`. */
export function modeString(node: VNode): string {
  const bits = ['r', 'w', 'x']
  let s = node.type === 'dir' ? 'd' : '-'
  for (let i = 8; i >= 0; i--) s += node.mode & (1 << i) ? bits[(8 - i) % 3] : '-'
  if (node.mode & 0o1000) s = s.slice(0, 9) + (node.mode & 0o001 ? 't' : 'T')
  return s
}

// ── Filesystem ──────────────────────────────────────────────────────────────

export class VFS {
  private readonly overlay = new Map<string, VNode>()

  constructor(
    private readonly base: ReadonlyMap<string, VNode>,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** Node at an absolute path, or null. */
  stat(path: string): VNode | null {
    const p = normalizePath(path)
    return this.overlay.get(p) ?? this.base.get(p) ?? null
  }

  /** Like stat, but distinguishes ENOENT from ENOTDIR (a file used as a directory). */
  lookup(path: string): VNode {
    const p = normalizePath(path)
    const node = this.stat(p)
    if (node) return node
    let parent = dirname(p)
    while (parent !== '/') {
      const n = this.stat(parent)
      if (n && n.type !== 'dir') throw new FsError('ENOTDIR', p)
      if (n) break
      parent = dirname(parent)
    }
    throw new FsError('ENOENT', p)
  }

  isDir(path: string): boolean {
    return this.stat(path)?.type === 'dir'
  }

  isOverlay(path: string): boolean {
    return this.overlay.has(normalizePath(path))
  }

  /** Names in a directory, sorted. Includes dotfiles; callers filter. */
  list(path: string): string[] {
    const p = normalizePath(path)
    const node = this.lookup(p)
    if (node.type !== 'dir') throw new FsError('ENOTDIR', p)
    if (!canRead(node)) throw new FsError('EACCES', p)
    const names = new Set<string>()
    const prefix = p === '/' ? '/' : p + '/'
    for (const source of [this.base, this.overlay]) {
      for (const key of source.keys()) {
        if (key.startsWith(prefix) && key.length > prefix.length && !key.slice(prefix.length).includes('/')) {
          names.add(key.slice(prefix.length))
        }
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'en'))
  }

  read(path: string): string {
    const p = normalizePath(path)
    const node = this.lookup(p)
    if (node.type === 'dir') throw new FsError('EISDIR', p)
    if (!canRead(node)) throw new FsError('EACCES', p)
    if (p === '/dev/null') return ''
    return node.content ?? ''
  }

  /** Create or overwrite (or append to) a file. */
  write(path: string, content: string, opts: { append?: boolean } = {}): void {
    const p = normalizePath(path)
    if (p === '/dev/null') return
    const existing = this.stat(p)
    if (existing) {
      if (existing.type === 'dir') throw new FsError('EISDIR', p)
      if (!canWrite(existing)) throw new FsError('EACCES', p)
      const next = opts.append ? (existing.content ?? '') + content : content
      this.ensureSpace(byteLength(next) - byteLength(existing.content ?? ''), p)
      this.overlay.set(p, { ...existing, content: next, mtime: this.clock() })
      return
    }
    this.checkCreate(p)
    this.ensureSpace(byteLength(content), p)
    this.overlay.set(p, { type: 'file', owner: 'guest', mode: 0o644, content, mtime: this.clock() })
  }

  touch(path: string): void {
    const p = normalizePath(path)
    const existing = this.stat(p)
    if (existing) {
      if (!canWrite(existing) && existing.owner !== 'guest') throw new FsError('EACCES', p)
      if (this.overlay.has(p)) this.overlay.set(p, { ...existing, mtime: this.clock() })
      return
    }
    this.write(p, '')
  }

  mkdir(path: string, opts: { parents?: boolean } = {}): void {
    const p = normalizePath(path)
    const existing = this.stat(p)
    if (existing) {
      if (opts.parents && existing.type === 'dir') return
      throw new FsError('EEXIST', p)
    }
    const parent = dirname(p)
    if (!this.stat(parent)) {
      if (!opts.parents) throw new FsError('ENOENT', p)
      this.mkdir(parent, opts)
    }
    this.checkCreate(p)
    this.overlay.set(p, { type: 'dir', owner: 'guest', mode: 0o755, mtime: this.clock() })
  }

  /**
   * Remove a file (or, with recursive, a directory tree). Returns the paths that could not be
   * removed and why, so `rm -r` can remove what it may and report the rest.
   */
  remove(path: string, opts: { recursive?: boolean } = {}): FsError[] {
    const p = normalizePath(path)
    const node = this.lookup(p)
    if (p === '/') return [new FsError('EACCES', p)]
    if (node.type === 'dir') {
      if (!opts.recursive) throw new FsError('EISDIR', p)
      const errors: FsError[] = []
      let children: string[] = []
      try {
        children = this.list(p)
      } catch (e) {
        return [e as FsError]
      }
      for (const name of children) errors.push(...this.remove(joinPath(p, name), opts))
      if (errors.length) return errors
      const denied = this.deleteDenied(p, node)
      if (denied) return [denied]
      this.overlay.delete(p)
      return []
    }
    const denied = this.deleteDenied(p, node)
    if (denied) return [denied]
    this.overlay.delete(p)
    return []
  }

  /** Move within the overlay (only the visitor's own files can move). */
  rename(from: string, to: string): void {
    const src = normalizePath(from)
    const dst = normalizePath(to)
    const node = this.lookup(src)
    const denied = this.deleteDenied(src, node)
    if (denied) throw denied
    if (dst === src || dst.startsWith(src + '/')) throw new FsError('EINVAL', dst)
    const existing = this.stat(dst)
    if (existing && existing.type === 'dir') throw new FsError('EISDIR', dst)
    if (existing && !canWrite(existing)) throw new FsError('EACCES', dst)
    this.checkCreate(dst)
    const moved: [string, VNode][] = []
    for (const [key, value] of this.overlay) {
      if (key === src || key.startsWith(src + '/')) moved.push([dst + key.slice(src.length), value])
    }
    for (const [key] of [...this.overlay]) if (key === src || key.startsWith(src + '/')) this.overlay.delete(key)
    for (const [key, value] of moved) this.overlay.set(key, value)
  }

  /** Every path under `path` (inclusive), depth-first, sorted. Skips unreadable dirs' contents. */
  walk(path: string): string[] {
    const p = normalizePath(path)
    const node = this.lookup(p)
    const out = [p]
    if (node.type === 'dir' && canRead(node)) {
      for (const name of this.list(p)) out.push(...this.walk(joinPath(p, name)))
    }
    return out
  }

  /** Bytes used by the visitor's files. */
  overlayBytes(): number {
    let total = 0
    for (const n of this.overlay.values()) total += n.content ? byteLength(n.content) : 0
    return total
  }

  serialize(): Record<string, OverlayEntry> {
    const out: Record<string, OverlayEntry> = {}
    for (const [path, n] of this.overlay) {
      if (n.owner !== 'guest') continue
      out[path] = n.type === 'dir' ? { t: 'd', m: n.mtime } : { t: 'f', c: n.content ?? '', m: n.mtime }
    }
    return out
  }

  /** Restore the visitor's files. Entries that would shadow Raj's files are ignored. */
  load(entries: Record<string, OverlayEntry> | undefined): void {
    this.overlay.clear()
    if (!entries) return
    const paths = Object.keys(entries).sort((a, b) => a.length - b.length)
    for (const path of paths) {
      const e = entries[path]
      const p = normalizePath(path)
      if (this.base.has(p) || !e || (e.t !== 'f' && e.t !== 'd')) continue
      const parent = this.stat(dirname(p))
      if (!parent || parent.type !== 'dir') continue
      this.overlay.set(
        p,
        e.t === 'd'
          ? { type: 'dir', owner: 'guest', mode: 0o755, mtime: e.m || this.clock() }
          : { type: 'file', owner: 'guest', mode: 0o644, content: String(e.c ?? ''), mtime: e.m || this.clock() },
      )
    }
  }

  clearOverlay(): void {
    this.overlay.clear()
  }

  private checkCreate(path: string): void {
    const parentPath = dirname(path)
    const parent = this.lookup(parentPath)
    if (parent.type !== 'dir') throw new FsError('ENOTDIR', path)
    if (!canWrite(parent)) throw new FsError('EACCES', path)
  }

  private deleteDenied(path: string, node: VNode): FsError | null {
    const parent = this.stat(dirname(path))
    if (!parent || !canWrite(parent)) return new FsError('EACCES', path)
    if (parent.mode & 0o1000 && node.owner !== 'guest') return new FsError('EACCES', path)
    if (!this.overlay.has(path)) return new FsError('EACCES', path)
    return null
  }

  private ensureSpace(delta: number, path: string): void {
    if (delta > 0 && this.overlayBytes() + delta > OVERLAY_LIMIT_BYTES) throw new FsError('ENOSPC', path)
  }
}
