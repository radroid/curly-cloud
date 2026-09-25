/** Helpers for the rsh unit tests (not a test file itself). */
import { SegmentSink } from './output'
import { Shell } from './shell'
import type { Segment, ShellHost, ShellStorage } from './types'

export interface MemoryStorage extends ShellStorage {
  data: string | null
}

export function memoryStorage(initial: string | null = null): MemoryStorage {
  const s: MemoryStorage = {
    data: initial,
    load: () => s.data,
    save: (d) => {
      s.data = d
    },
    clear: () => {
      s.data = null
    },
  }
  return s
}

export const FIXED_NOW = new Date(Date.UTC(2026, 8, 25, 12, 0, 0))

export async function makeShell(host: ShellHost = {}): Promise<Shell> {
  const sh = new Shell({ columns: () => 100, now: () => FIXED_NOW, random: () => 0.5, sleep: async () => {}, ...host })
  await sh.ready
  return sh
}

export interface RunResult {
  out: string
  err: string
  code: number
  outSegs: Segment[]
  errSegs: Segment[]
  /** Prompts shown by readLine, in order. */
  prompts: string[]
}

export async function run(
  sh: Shell,
  line: string,
  opts: { input?: string[]; signal?: AbortSignal; interactive?: boolean } = {},
): Promise<RunResult> {
  const stdout = new SegmentSink()
  const stderr = new SegmentSink()
  const queue = [...(opts.input ?? [])]
  const prompts: string[] = []
  const readLine = opts.input
    ? async (prompt: Segment[]): Promise<string | null> => {
        prompts.push(prompt.map((p) => p.text).join(''))
        return queue.length ? queue.shift()! : null
      }
    : undefined
  const io = { stdout, stderr, signal: opts.signal, readLine }
  const code = opts.interactive === false ? await sh.run(line, io) : await sh.submit(line, io)
  return { out: stdout.text, err: stderr.text, code, outSegs: stdout.segments, errSegs: stderr.segments, prompts }
}
