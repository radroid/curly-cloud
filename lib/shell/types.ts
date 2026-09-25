/**
 * Contracts for rsh, the terminal's shell engine. Pure TypeScript: no React, no DOM.
 * The UI (app/terminal) talks to the engine only through these types and the `Shell` class.
 */
import type { AnswerEvent } from '@/lib/rag/types'

/** How a piece of output text is styled. The UI maps each to a term-palette class. */
export type SegmentStyle = 'plain' | 'dim' | 'accent' | 'highlight' | 'error' | 'prompt' | 'strong'

/** Output can link somewhere. Commands run in the terminal when clicked. */
export type SegmentLink =
  | { kind: 'command'; command: string }
  | { kind: 'route'; href: string }
  | { kind: 'url'; href: string }

export interface Segment {
  /** May contain '\n': output is a stream, and newlines end lines. */
  text: string
  style?: SegmentStyle
  link?: SegmentLink
}

/** One rendered line of output. */
export type Line = Segment[]

/** Where a command writes. The terminal's sink renders segments; pipe/file sinks keep plain text. */
export interface Sink {
  write(segments: Segment[]): void
}

/** Ask the user for one line of input (sub-prompts, heredocs, `fit`). Resolves null on EOF or Ctrl-C. */
export type ReadLine = (prompt: Segment[], opts?: { signal?: AbortSignal }) => Promise<string | null>

export interface ShellIO {
  stdout: Sink
  stderr: Sink
  /** Aborted by Ctrl-C. */
  signal?: AbortSignal
  /** Present when a human is at the keyboard. Without it, interactive commands read stdin or fail. */
  readLine?: ReadLine
}

/** Persistence for history, exported vars, aliases, the /tmp overlay and learn progress. */
export interface ShellStorage {
  load(): string | null
  save(data: string): void
  clear(): void
}

export type StreamAnswerFn = (url: string, body: unknown, signal?: AbortSignal) => AsyncIterable<AnswerEvent>

/** Everything the engine needs from the outside world. All optional so tests can stub what they use. */
export interface ShellHost {
  /** Go to an in-app route ('/mac') or open an external URL (new tab). */
  navigate?(href: string, opts: { external: boolean }): void
  /** Clear the screen (Ctrl-L / `clear`). */
  clear?(): void
  /** e.g. 'https://curlycloud.dev'. Used by `mcp` to print the endpoint. */
  origin?: string
  /** Visible width in characters, for layouts that adapt (neofetch, explain). */
  columns?(): number
  reducedMotion?(): boolean
  now?(): Date
  random?(): number
  fetch?: typeof fetch
  /** Defaults to `streamAnswer` from lib/client/sse. */
  streamAnswer?: StreamAnswerFn
  storage?: ShellStorage
  /** Sleep that resolves early when aborted (matrix, boot). Defaults to setTimeout. */
  sleep?(ms: number, signal?: AbortSignal): Promise<void>
}

/** Result of Tab completion on `line` at `cursor`. */
export interface Completion {
  /** Range of the word being completed. */
  start: number
  end: number
  /** Replacement for line.slice(start, end), or null when there is nothing unambiguous to insert. */
  text: string | null
  /** Candidates to list on a double Tab (display form). Empty when `text` completed it. */
  options: string[]
}
