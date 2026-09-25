'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Shell,
  type Completion,
  type Line,
  type ReadLine,
  type Segment,
  type ShellHost,
  type ShellIO,
  type Sink,
} from '@/lib/shell'
import { formatColumns } from './line-editor'

const STORAGE_KEY = 'curlycloud:terminal:v1'
const NEWLINE: Segment = { text: '\n' }
const INTERRUPT: Segment = { text: '^C', style: 'dim' }

/** The boot reveal stays under a second: boot lines share this budget, then the welcome follows. */
const BOOT_BUDGET_MS = 560
const BOOT_STEP_MAX_MS = 70
const WELCOME_PAUSE_MS = 160
/** How long freshly printed lines keep fading in after boot (covers the welcome). */
const INTRO_TAIL_MS = 500

/**
 * booting: the boot log is revealing. idle: the PS1 prompt is live. running: a command owns the
 * terminal. reading: a running command is waiting on `readLine`.
 */
export type SessionMode = 'booting' | 'idle' | 'running' | 'reading'

export interface SessionOutput {
  write(segments: Segment[]): void
  flush(): void
  newlineIfOpen(): void
  clear(): void
  columns(): number
  /** Scroll to the newest output and keep following it. */
  follow(): void
}

export interface TerminalSession {
  mode: SessionMode
  /** PS1 while idle or running; the command's own prompt while it reads a line. */
  prompt: readonly Segment[]
  /** True during the boot and just after it, while new lines fade in. */
  intro: boolean
  /** Current mode, read synchronously (event handlers can't wait for a re-render). */
  getMode(): SessionMode
  history(): readonly string[]
  /** Echo the prompt and `line`, then run it. Ignored unless idle. */
  run(line: string): void
  /** Echo and hand `text` to the pending readLine. */
  answer(text: string): void
  /** Ctrl-C: cancel the pending readLine and abort the command, or drop the current line when idle. */
  interrupt(current: string): void
  /** Ctrl-D on an empty line while a command reads: end of input. */
  endOfInput(): void
  clearScreen(): void
  complete(line: string, cursor: number): Completion | null
  /** Double Tab: echo the line and list the candidates in columns. */
  listOptions(line: string, options: readonly string[]): void
  /** Feed pasted lines one at a time, each once the terminal is ready. Resolves false if interrupted. */
  feed(lines: readonly string[]): Promise<boolean>
  skipBoot(): void
}

interface PendingRead {
  prompt: Segment[]
  settle(value: string | null): void
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Owns the Shell and everything between it and the screen: running commands, readLine sub-prompts,
 * Ctrl-C, the boot sequence and the paste queue. The Shell is created on the client only (it reads
 * localStorage), inside an effect. All returned functions are stable.
 */
export function useTerminalSession(output: SessionOutput, focusInput: () => void): TerminalSession {
  const router = useRouter()
  const routerRef = useRef(router)
  const [mode, setModeState] = useState<SessionMode>('booting')
  const [ps1, setPs1] = useState<Segment[]>([])
  const [readPrompt, setReadPrompt] = useState<Segment[]>([])
  const [intro, setIntro] = useState(true)

  const shellRef = useRef<Shell | null>(null)
  const modeRef = useRef<SessionMode>('booting')
  const mountedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const pendingRef = useRef<PendingRead | null>(null)
  const waitersRef = useRef<(() => void)[]>([])
  const feedRef = useRef<object | null>(null)
  const skipRef = useRef<(() => void) | null>(null)

  const releaseWaiters = useCallback((): void => {
    const waiters = waitersRef.current
    waitersRef.current = []
    for (const resolve of waiters) resolve()
  }, [])

  const setMode = useCallback(
    (next: SessionMode): void => {
      modeRef.current = next
      setModeState(next)
      if (next === 'idle' || next === 'reading') releaseWaiters()
    },
    [releaseWaiters],
  )

  const sink = useMemo<Sink>(() => ({ write: (segments) => output.write(segments) }), [output])

  const readLine = useCallback<ReadLine>(
    (linePrompt, opts) =>
      new Promise<string | null>((resolve) => {
        const signals = [opts?.signal, abortRef.current?.signal].filter((s): s is AbortSignal => !!s)
        if (!mountedRef.current || signals.some((s) => s.aborted)) {
          resolve(null)
          return
        }
        pendingRef.current?.settle(null)
        output.flush()
        const onAbort = (): void => pending.settle(null)
        const pending: PendingRead = {
          prompt: linePrompt,
          settle(value) {
            if (pendingRef.current !== pending) return
            pendingRef.current = null
            for (const s of signals) s.removeEventListener('abort', onAbort)
            if (mountedRef.current && modeRef.current === 'reading') setMode(abortRef.current ? 'running' : 'idle')
            resolve(value)
          },
        }
        pendingRef.current = pending
        for (const s of signals) s.addEventListener('abort', onAbort, { once: true })
        setReadPrompt(linePrompt)
        setMode('reading')
      }),
    [output, setMode],
  )

  const run = useCallback(
    (line: string): void => {
      const shell = shellRef.current
      if (!shell || modeRef.current !== 'idle') return
      output.newlineIfOpen()
      output.write([...shell.prompt(), { text: line }, NEWLINE])
      output.flush()
      output.follow()
      if (!line.trim()) return

      const controller = new AbortController()
      abortRef.current = controller
      setMode('running')
      const io: ShellIO = { stdout: sink, stderr: sink, signal: controller.signal, readLine }
      shell
        .submit(line, io)
        .catch((error: unknown) => {
          if (controller.signal.aborted || !mountedRef.current) return
          const message = error instanceof Error ? error.message : String(error)
          output.write([{ text: `rsh: ${message}`, style: 'error' }, NEWLINE])
        })
        .finally(() => {
          if (abortRef.current === controller) abortRef.current = null
          pendingRef.current?.settle(null)
          if (!mountedRef.current) return
          output.flush()
          setPs1(shell.prompt())
          setMode('idle')
        })
    },
    [output, sink, readLine, setMode],
  )

  const answer = useCallback(
    (text: string): void => {
      const pending = pendingRef.current
      if (!pending) return
      output.newlineIfOpen()
      output.write([...pending.prompt, { text }, NEWLINE])
      output.flush()
      output.follow()
      pending.settle(text)
    },
    [output],
  )

  const interrupt = useCallback(
    (current: string): void => {
      skipRef.current?.()
      feedRef.current = null
      const shell = shellRef.current
      const pending = pendingRef.current
      const controller = abortRef.current
      if (pending) {
        output.newlineIfOpen()
        output.write([...pending.prompt, { text: current }, INTERRUPT, NEWLINE])
      } else if (controller) {
        // Mid-stream, ^C lands where the output stopped, like a real terminal.
        output.write([INTERRUPT, NEWLINE])
      } else if (shell) {
        output.newlineIfOpen()
        output.write([...shell.prompt(), { text: current }, INTERRUPT, NEWLINE])
      }
      output.flush()
      output.follow()
      controller?.abort()
      pending?.settle(null)
    },
    [output],
  )

  const endOfInput = useCallback((): void => {
    const pending = pendingRef.current
    if (!pending) return
    output.newlineIfOpen()
    output.write([...pending.prompt, NEWLINE])
    output.flush()
    output.follow()
    pending.settle(null)
  }, [output])

  const clearScreen = useCallback((): void => output.clear(), [output])

  const complete = useCallback(
    (line: string, cursor: number): Completion | null => shellRef.current?.complete(line, cursor) ?? null,
    [],
  )

  const listOptions = useCallback(
    (line: string, options: readonly string[]): void => {
      const shell = shellRef.current
      if (!shell) return
      output.newlineIfOpen()
      output.write([...shell.prompt(), { text: line }, NEWLINE])
      for (const row of formatColumns(options, output.columns())) output.write([{ text: row, style: 'accent' }, NEWLINE])
      output.flush()
      output.follow()
    },
    [output],
  )

  const waitReady = useCallback(
    (): Promise<void> =>
      new Promise<void>((resolve) => {
        const current = modeRef.current
        if (current === 'idle' || current === 'reading' || !mountedRef.current) resolve()
        else waitersRef.current.push(resolve)
      }),
    [],
  )

  const feed = useCallback(
    async (lines: readonly string[]): Promise<boolean> => {
      const token = {}
      feedRef.current = token
      for (const line of lines) {
        await waitReady()
        if (feedRef.current !== token || !mountedRef.current) return false
        // run() doesn't wait for the command: the next pasted line may be for its readLine.
        if (pendingRef.current) answer(line)
        else run(line)
      }
      await waitReady()
      const finished = feedRef.current === token && mountedRef.current
      if (finished) feedRef.current = null
      return finished
    },
    [answer, run, waitReady],
  )

  const getMode = useCallback((): SessionMode => modeRef.current, [])
  const history = useCallback((): readonly string[] => shellRef.current?.history ?? [], [])
  const skipBoot = useCallback((): void => skipRef.current?.(), [])

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    mountedRef.current = true
    modeRef.current = 'booting'
    setModeState('booting')
    setIntro(true)

    const host: ShellHost = {
      navigate(href, { external }) {
        if (external) window.open(href, '_blank', 'noopener,noreferrer')
        else routerRef.current.push(href)
      },
      clear: () => output.clear(),
      origin: window.location.origin,
      columns: () => output.columns(),
      reducedMotion: prefersReducedMotion,
      storage: {
        load() {
          try {
            return window.localStorage.getItem(STORAGE_KEY)
          } catch {
            return null
          }
        },
        save(data) {
          try {
            window.localStorage.setItem(STORAGE_KEY, data)
          } catch {
            // Private mode or a full quota: the session still works, it just won't persist.
          }
        },
        clear() {
          try {
            window.localStorage.removeItem(STORAGE_KEY)
          } catch {
            // Nothing stored, nothing to clear.
          }
        },
      },
    }
    const shell = shellRef.current ?? new Shell(host)
    shellRef.current = shell
    setPs1(shell.prompt())
    // ~/.profile and any saved PS1 land when the engine's `ready` resolves; the prompt may change then.
    shell.ready.then(
      () => {
        if (mountedRef.current) setPs1(shell.prompt())
      },
      () => {},
    )

    const bootLines = shell.bootLog()
    let index = 0
    let done = false
    let stepTimer: ReturnType<typeof setTimeout> | undefined
    let introTimer: ReturnType<typeof setTimeout> | undefined
    const writeLine = (line: Line): void => output.write([...line, NEWLINE])

    const finish = (): void => {
      if (done) return
      done = true
      clearTimeout(stepTimer)
      window.removeEventListener('keydown', finish, true)
      window.removeEventListener('pointerdown', finish, true)
      skipRef.current = null
      while (index < bootLines.length) writeLine(bootLines[index++])
      // Built late: welcome() lays out for columns(), which is measured by now.
      for (const line of shell.welcome()) writeLine(line)
      output.flush()
      output.follow()
      setMode('idle')
      focusInput()
      introTimer = setTimeout(() => setIntro(false), INTRO_TAIL_MS)
    }
    skipRef.current = finish
    focusInput()

    if (prefersReducedMotion() || !bootLines.length) {
      finish()
      setIntro(false)
    } else {
      // Capture phase: the boot finishes before the key reaches the input, so Enter still runs.
      window.addEventListener('keydown', finish, true)
      window.addEventListener('pointerdown', finish, true)
      const step = Math.min(BOOT_STEP_MAX_MS, Math.floor(BOOT_BUDGET_MS / bootLines.length))
      const tick = (): void => {
        if (index >= bootLines.length) return finish()
        writeLine(bootLines[index++])
        stepTimer = setTimeout(tick, index < bootLines.length ? step : WELCOME_PAUSE_MS)
      }
      tick()
    }

    return () => {
      mountedRef.current = false
      done = true
      clearTimeout(stepTimer)
      clearTimeout(introTimer)
      window.removeEventListener('keydown', finish, true)
      window.removeEventListener('pointerdown', finish, true)
      skipRef.current = null
      feedRef.current = null
      abortRef.current?.abort()
      pendingRef.current?.settle(null)
      releaseWaiters()
      output.clear()
    }
  }, [output, focusInput, setMode, releaseWaiters])

  return {
    mode,
    prompt: mode === 'reading' ? readPrompt : ps1,
    intro,
    getMode,
    history,
    run,
    answer,
    interrupt,
    endOfInput,
    clearScreen,
    complete,
    listOptions,
    feed,
    skipBoot,
  }
}
