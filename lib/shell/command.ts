import { FsError } from './vfs'
import { err, toSegments, writeln, type Printable } from './output'
import type { ReadLine, Sink } from './types'
import type { ExecIO, Shell } from './shell'

export type CommandGroup = 'files' | 'text' | 'shell' | 'raj' | 'learn' | 'fun'

export interface ManPage {
  synopsis: string[]
  description: string[]
  options?: [string, string][]
  examples?: [string, string][]
  seeAlso?: string[]
}

/** What an operand means, for `explain`. */
export type OperandKind = 'path' | 'file' | 'dir' | 'text' | 'pattern' | 'command' | 'name' | 'assignment' | 'target' | 'question' | 'number'

export interface CommandContext {
  name: string
  args: string[]
  /** Exported environment for this command, including `NAME=value cmd` prefixes. */
  env: Record<string, string>
  /** Piped or redirected input; null when stdin is the keyboard. */
  stdin: string | null
  stdout: Sink
  stderr: Sink
  /** stdout is the screen (not a pipe, file or $(…)). */
  isTTY: boolean
  signal: AbortSignal
  readLine: ReadLine | null
  shell: Shell
}

export interface CommandDef {
  name: string
  summary: string
  /** builtin: part of the shell · bin: /bin · local: /usr/local/bin (Raj's tools). */
  kind: 'builtin' | 'bin' | 'local'
  group: CommandGroup
  man: ManPage
  /** Flag descriptions for `explain` (e.g. { '-l': 'long format' }). */
  flags?: Record<string, string>
  /** Flags that consume the next argument (e.g. ['-n']). */
  valueFlags?: string[]
  /** Operand roles in order; the last one repeats. */
  operands?: { kind: OperandKind; label: string }[]
  /** A sentence for `explain`'s "in words", given the expanded args. */
  describe?(args: string[], shell: Shell): string | null
  /** Tab completion for arguments (null → complete paths). */
  complete?(shell: Shell, argIndex: number, prev: string[]): string[] | null
  /** Hidden from help (aliases like `builds`, `.`). */
  hidden?: boolean
  run(ctx: CommandContext): Promise<number> | number
}

export function out(ctx: CommandContext, ...parts: Printable[]): void {
  const segments = toSegments(parts)
  if (segments.length) ctx.stdout.write(segments)
}

export function outln(ctx: CommandContext, ...parts: Printable[]): void {
  writeln(ctx.stdout, ...parts)
}

/** Print `name: message` to stderr and return the exit code. */
export function fail(ctx: CommandContext, message: Printable, code = 1): number {
  writeln(ctx.stderr, err(`${ctx.name}: `), typeof message === 'string' ? err(message) : message)
  return code
}

/** Print an invalid-usage error with a pointer to the manual. */
export function usage(ctx: CommandContext, message: string): number {
  writeln(ctx.stderr, err(`${ctx.name}: ${message}`))
  writeln(ctx.stderr, { text: `Try 'man ${ctx.name}' for usage.`, style: 'dim' })
  return 2
}

/** Report a filesystem error the way coreutils does: `cat: nope.txt: No such file or directory`. */
export function fsFail(ctx: CommandContext, shown: string, e: unknown, verb?: string): number {
  if (e instanceof FsError) {
    const prefix = verb ? `${verb} '${shown}'` : shown
    writeln(ctx.stderr, err(`${ctx.name}: ${prefix}: ${e.message}`))
    if (e.code === 'EACCES') ctx.shell.explainPermission(ctx.stderr, e.path)
    if (e.code === 'ENOSPC') writeln(ctx.stderr, { text: 'Your files are capped at 200 KB. Free space with rm, or run reset.', style: 'dim' })
    return 1
  }
  throw e
}

/** Read each operand (or stdin). Calls `each` with the text; reports errors and returns the exit code. */
export function readInputs(
  ctx: CommandContext,
  operands: string[],
  each: (text: string, name: string | null) => void,
): number {
  if (!operands.length) {
    if (ctx.stdin === null) {
      writeln(
        ctx.stderr,
        err(`${ctx.name}: no input: give it a file, or pipe something in`),
      )
      writeln(ctx.stderr, { text: `e.g. ${ctx.name} about.txt  or  cat about.txt | ${ctx.name}`, style: 'dim' })
      return 1
    }
    each(ctx.stdin, null)
    return 0
  }
  let status = 0
  for (const op of operands) {
    if (op === '-') {
      each(ctx.stdin ?? '', null)
      continue
    }
    try {
      each(ctx.shell.vfs.read(ctx.shell.resolve(op)), op)
    } catch (e) {
      status = fsFail(ctx, op, e)
    }
  }
  return status
}

/** Split text into lines, dropping the empty string after a trailing newline. */
export function splitLines(text: string): string[] {
  if (!text) return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function joinLines(lines: string[]): string {
  return lines.length ? lines.join('\n') + '\n' : ''
}

/** The command's streams as shell I/O, for commands that run other commands (env, source, sudo). */
export function ioOf(ctx: CommandContext): ExecIO {
  return { stdin: ctx.stdin, stdout: ctx.stdout, stderr: ctx.stderr, isTTY: ctx.isTTY, signal: ctx.signal, readLine: ctx.readLine }
}
