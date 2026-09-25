'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, KeyboardEvent, MouseEvent } from 'react'
import { useReducedMotion } from '@/app/lib/use-reduced-motion'
import { hasTextSelection, killToStart, killWordBefore } from './line-editor'
import { OutputLine, PromptSegments, type RunCommand } from './output-line'
import { TerminalFooter, type ChipAction } from './terminal-footer'
import { COLUMN_PROBE, useColumns } from './use-columns'
import { useScrollback } from './use-scrollback'
import { useStickToBottom } from './use-stick-to-bottom'
import { useTerminalSession, type SessionOutput } from './use-terminal-session'

/** Where ↑/↓ currently are in the history list. `index` null means the visitor's own draft. */
interface HistoryCursor {
  index: number | null
  draft: string
}

/** Elements that handle their own clicks; clicking them must not pull focus to the input. */
const INTERACTIVE = 'a, button, input, textarea, select, summary, [role="button"]'

export function Terminal() {
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const promptId = useId()
  const statusId = useId()
  const reducedMotion = useReducedMotion()

  const { view, write, flush, newlineIfOpen, clear } = useScrollback()
  const { follow, onScroll } = useStickToBottom(scrollRef, contentRef)
  const columns = useColumns(columnRef, probeRef)
  const focusInput = useCallback((): void => inputRef.current?.focus({ preventScroll: true }), [])
  const output = useMemo<SessionOutput>(
    () => ({ write, flush, newlineIfOpen, clear, columns, follow }),
    [write, flush, newlineIfOpen, clear, columns, follow],
  )
  const session = useTerminalSession(output, focusInput)
  const { mode, getMode, run, answer, interrupt, endOfInput, clearScreen, complete, listOptions, feed, history } = session

  const [draft, setDraft] = useState('')
  const caretRef = useRef<number | null>(null)
  const tabRef = useRef<{ value: string; caret: number } | null>(null)
  const cursorRef = useRef<HistoryCursor>({ index: null, draft: '' })
  /** Answers typed at readLine prompts (`raj>` questions, heredoc lines), for ↑ while a command reads. */
  const answersRef = useRef<string[]>([])

  const running = mode === 'running'
  const reading = mode === 'reading'

  /** Replace the draft and put the caret at `caret` once React has written the new value. */
  const edit = useCallback((value: string, caret: number): void => {
    const input = inputRef.current
    if (input && input.value === value) {
      input.setSelectionRange(caret, caret)
      return
    }
    caretRef.current = caret
    setDraft(value)
  }, [])

  useLayoutEffect(() => {
    const caret = caretRef.current
    if (caret === null) return
    caretRef.current = null
    inputRef.current?.setSelectionRange(caret, caret)
  }, [draft])

  const resetHistoryCursor = useCallback((): void => {
    cursorRef.current = { index: null, draft: '' }
  }, [])

  // Idle and reading have different histories; switching between them starts from the draft again.
  useEffect(() => {
    resetHistoryCursor()
    tabRef.current = null
  }, [mode, resetHistoryCursor])

  const recall = useCallback(
    (direction: -1 | 1, value: string): void => {
      const list = getMode() === 'reading' ? answersRef.current : history()
      const cursor = cursorRef.current
      if (direction < 0) {
        if (!list.length) return
        if (cursor.index === null) cursorRef.current = { index: list.length - 1, draft: value }
        else if (cursor.index > 0) cursorRef.current = { ...cursor, index: cursor.index - 1 }
        else return
      } else {
        if (cursor.index === null) return
        if (cursor.index >= list.length - 1) {
          cursorRef.current = { index: null, draft: '' }
          edit(cursor.draft, cursor.draft.length)
          return
        }
        cursorRef.current = { ...cursor, index: cursor.index + 1 }
      }
      const entry = list[cursorRef.current.index ?? 0] ?? ''
      edit(entry, entry.length)
    },
    [getMode, history, edit],
  )

  /** Tab: insert an unambiguous completion; a second Tab with nothing new lists the candidates. */
  const completeAt = useCallback(
    (value: string, caret: number): void => {
      const result = complete(value, caret)
      if (!result) return
      const current = value.slice(result.start, result.end)
      if (result.text !== null && result.text !== current) {
        const next = value.slice(0, result.start) + result.text + value.slice(result.end)
        const at = result.start + result.text.length
        edit(next, at)
        tabRef.current = result.options.length ? { value: next, caret: at } : null
        return
      }
      if (!result.options.length) return
      const last = tabRef.current
      if (last && last.value === value && last.caret === caret) listOptions(value, result.options)
      else tabRef.current = { value, caret }
    },
    [complete, edit, listOptions],
  )

  const submit = useCallback(
    (value: string): void => {
      const current = getMode()
      if (current === 'reading') {
        if (value && answersRef.current[answersRef.current.length - 1] !== value) answersRef.current.push(value)
        answer(value)
      } else if (current === 'idle') {
        run(value)
      } else {
        return
      }
      setDraft('')
      resetHistoryCursor()
    },
    [getMode, answer, run, resetHistoryCursor],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.nativeEvent.isComposing) return
    const input = event.currentTarget
    const value = input.value
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const current = getMode()
    const plainKey = !event.ctrlKey && !event.metaKey && !event.altKey
    if (event.key !== 'Tab') tabRef.current = null

    if (event.key === 'Enter' && plainKey && !event.shiftKey) {
      event.preventDefault()
      submit(value)
      return
    }

    if (event.key === 'Tab') {
      // Shift+Tab, and Tab on an empty line, keep moving focus: the page stays keyboard-navigable.
      if (!plainKey || event.shiftKey || current !== 'idle' || value === '') return
      event.preventDefault()
      completeAt(value, start)
      return
    }

    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && plainKey && !event.shiftKey) {
      if (current !== 'idle' && current !== 'reading') return
      event.preventDefault()
      recall(event.key === 'ArrowUp' ? -1 : 1, value)
      return
    }

    if (!event.ctrlKey || event.metaKey || event.altKey) return
    const editable = current === 'idle' || current === 'reading'
    switch (event.key.toLowerCase()) {
      case 'c':
        if (hasTextSelection(input)) return // let the copy happen
        event.preventDefault()
        interrupt(value)
        setDraft('')
        resetHistoryCursor()
        return
      case 'l':
        event.preventDefault()
        clearScreen()
        return
      case 'a':
        event.preventDefault()
        input.setSelectionRange(0, 0)
        return
      case 'e':
        event.preventDefault()
        input.setSelectionRange(value.length, value.length)
        return
      case 'u': {
        event.preventDefault()
        if (!editable) return
        const next = killToStart(value, start)
        edit(next.value, next.caret)
        return
      }
      case 'w': {
        event.preventDefault()
        if (!editable) return
        const next = start === end ? killWordBefore(value, start) : { value: value.slice(0, start) + value.slice(end), caret: start }
        edit(next.value, next.caret)
        return
      }
      case 'd':
        if (current === 'reading' && value === '') {
          event.preventDefault()
          endOfInput()
        }
        return
    }
  }

  /** Multi-line paste: each full line runs (or answers the prompt) in order; the last partial line stays typed. */
  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text')
    if (!/[\r\n]/.test(text)) return
    event.preventDefault()
    const input = event.currentTarget
    const start = input.selectionStart ?? draft.length
    const end = input.selectionEnd ?? draft.length
    const lines = (draft.slice(0, start) + text + draft.slice(end)).replace(/\r\n?/g, '\n').split('\n')
    const rest = lines.pop() ?? ''
    setDraft('')
    resetHistoryCursor()
    void feed(lines).then((finished) => {
      if (finished && rest) edit(rest, rest.length)
    })
  }

  const onCommand = useCallback<RunCommand>(
    (command, viaKeyboard) => {
      if (getMode() !== 'idle') return
      run(command)
      // On touch, focusing would pop the keyboard up while someone is just tapping through links.
      if (viaKeyboard || window.matchMedia('(pointer: fine)').matches) focusInput()
    },
    [getMode, run, focusInput],
  )

  const onChip = (action: ChipAction): void => {
    const current = getMode()
    const input = inputRef.current
    switch (action.kind) {
      case 'run':
        if (current === 'idle') run(action.command)
        return
      case 'insert': {
        if (current !== 'idle') return
        const next = draft.startsWith(action.text) ? draft : action.text + draft.trimStart()
        edit(next, next.length)
        focusInput()
        return
      }
      case 'complete':
        if (current !== 'idle') return
        completeAt(draft, input?.selectionStart ?? draft.length)
        focusInput()
        return
      case 'history':
        recall(-1, input?.value ?? draft)
        focusInput()
        return
      case 'interrupt':
        interrupt(draft)
        setDraft('')
        resetHistoryCursor()
        return
    }
  }

  /** A click anywhere in the log focuses the input, unless it made a selection or hit a control. */
  const onMouseUp = (event: MouseEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest(INTERACTIVE)) return
    if (window.getSelection()?.toString()) return
    focusInput()
  }

  // Outside the input: typing lands in the prompt, and Ctrl-C still stops a running command.
  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent): void => {
      const input = inputRef.current
      if (!input || event.defaultPrevented || document.activeElement === input) return
      const busy = getMode() === 'running' || getMode() === 'reading'
      if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'c') {
        if (busy && !hasTextSelection()) {
          event.preventDefault()
          interrupt(input.value)
          setDraft('')
        }
        return
      }
      const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
      const nowhere = !document.activeElement || document.activeElement === document.body
      if (printable && nowhere) focusInput()
    }
    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [getMode, interrupt, focusInput])

  const lastIndex = view.lines.length - 1

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <h1 className="sr-only">Raj Dholakia’s résumé, as a terminal</h1>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        onMouseUp={onMouseUp}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:color-mix(in_oklab,var(--color-term-dim)_35%,transparent)_transparent] [scrollbar-width:thin]"
      >
        <div
          ref={contentRef}
          className="mx-auto w-full max-w-5xl px-4 pt-5 pb-10 text-[13.5px] leading-[1.6] sm:px-8 sm:pt-7 sm:text-[15px] sm:leading-[1.65]"
        >
          <div ref={columnRef} className="relative">
            <span ref={probeRef} aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 whitespace-pre">
              {COLUMN_PROBE}
            </span>

            <div
              role="log"
              aria-label="Terminal output"
              aria-live="polite"
              aria-relevant="additions"
              aria-busy={mode === 'running' || mode === 'booting'}
              data-intro={session.intro ? '' : undefined}
              className="*:transition-opacity *:duration-300 data-intro:*:starting:opacity-0"
            >
              {view.lines.map((line, i) =>
                // The open last line is where the cursor sits; the input row below stands in for it.
                i === lastIndex && line.length === 0 ? null : <OutputLine key={view.ids[i]} line={line} onCommand={onCommand} />,
              )}
            </div>

            <div
              className={`relative -mx-2 flex flex-wrap items-baseline rounded-md px-2 text-base leading-[1.6] transition-[background-color,opacity] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sun before:opacity-0 before:transition-opacity focus-within:bg-black/20 focus-within:before:opacity-100 sm:text-[15px] sm:leading-[1.65] ${
                mode === 'booting' ? 'opacity-0' : ''
              }`}
            >
              {running ? (
                <span
                  id={statusId}
                  className="mr-3 flex items-baseline gap-2.5 text-term-dim transition-opacity delay-300 duration-300 starting:opacity-0"
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-[0.9em] w-[0.55em] translate-y-[0.1em] rounded-[1px] bg-sun/80 ${reducedMotion ? '' : 'animate-pulse'}`}
                  />
                  Running. Ctrl-C stops it.
                </span>
              ) : (
                <PromptSegments id={promptId} segments={session.prompt} />
              )}
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(event) => {
                  // No typing while a command runs: skipping the update makes React restore the value.
                  // (Not the readOnly attribute: toggling it on a focused input can drop the iOS keyboard.)
                  if (getMode() === 'running') return
                  setDraft(event.target.value)
                  tabRef.current = null
                  follow()
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                aria-readonly={running}
                aria-label={reading ? 'Terminal input' : 'Terminal command'}
                aria-describedby={running ? statusId : promptId}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="send"
                // Inline because the global :focus-visible outline is unlayered and beats utilities.
                // The row shows focus instead: a recessed band (darker, so contrast only rises) and a sun tick.
                style={{ outline: 'none' }}
                className={`min-w-[6ch] flex-1 basis-16 border-0 bg-transparent p-0 text-term-text ${running ? 'caret-transparent' : 'caret-sun'}`}
              />
            </div>
          </div>
        </div>
      </div>

      <TerminalFooter mode={mode} onChip={onChip} />
    </main>
  )
}
