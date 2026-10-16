'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useKeyShortcut } from '@/app/lib/use-key-shortcut'

type Status = 'idle' | 'copied' | 'failed'
type CopyState = { copy: () => void; status: Status; held: boolean }

const CopyContext = createContext<CopyState | null>(null)

const MESSAGE: Record<Status, string> = {
  idle: '',
  copied: '✓ Prompt copied. Paste it into your agent.',
  failed: 'Couldn’t copy. Select the prompt and press ⌘C.',
}

/** Owns the clipboard, the page-wide C shortcut and the toast, so every CopyKey shares them. */
export function PromptCopyProvider({ text, children }: { text: string; children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = useCallback((): void => {
    const show = (next: Status): void => {
      setStatus(next)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setStatus('idle'), 1800)
    }
    // The Clipboard API needs a secure context; without it there's nothing reliable to fall back on.
    const write = navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject(new Error('no clipboard'))
    write.then(
      () => show('copied'),
      () => show('failed'),
    )
  }, [text])

  useEffect(() => () => clearTimeout(timer.current), [])

  const held = useKeyShortcut('c', copy)
  const value = useMemo(() => ({ copy, status, held }), [copy, status, held])

  return (
    <CopyContext.Provider value={value}>
      {children}
      <p
        role="status"
        className={[
          'pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-term-accent px-3.5 py-2 font-mono text-[13px] font-medium text-night-deep shadow-lg transition-[opacity,translate] duration-200 still:transition-none',
          status === 'idle' ? '-translate-y-2 opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {MESSAGE[status]}
      </p>
    </CopyContext.Provider>
  )
}

const KEY = {
  lg: 'size-14 rounded-xl text-2xl shadow-[0_5px_0_var(--color-term-dim),0_8px_18px_rgb(0_0_0/0.45)] group-active:translate-y-1 group-active:shadow-[0_1px_0_var(--color-term-dim),0_3px_8px_rgb(0_0_0/0.4)] data-held:translate-y-1 data-held:shadow-[0_1px_0_var(--color-term-dim),0_3px_8px_rgb(0_0_0/0.4)]',
  sm: 'size-[30px] rounded-[7px] text-sm shadow-[0_3px_0_var(--color-term-dim)] group-active:translate-y-0.5 group-active:shadow-[0_1px_0_var(--color-term-dim)] data-held:translate-y-0.5 data-held:shadow-[0_1px_0_var(--color-term-dim)]',
}

/** A keycap button: click it, tap it, or press C anywhere (the cap goes down either way). */
export function CopyKey({ label, size = 'lg' }: { label: string; size?: 'lg' | 'sm' }) {
  const state = useContext(CopyContext)
  if (!state) throw new Error('CopyKey must sit inside PromptCopyProvider')
  const lg = size === 'lg'
  return (
    <button
      type="button"
      onClick={state.copy}
      aria-keyshortcuts="C"
      className={`group inline-flex items-center rounded-lg text-term-text ${lg ? 'gap-3.5 text-[17px] font-semibold' : 'gap-2 font-mono text-[13px] font-medium'}`}
    >
      <kbd
        aria-hidden
        data-held={state.held || undefined}
        className={`grid place-items-center border border-term-accent bg-linear-to-b from-term-text to-term-accent font-mono font-semibold text-night-deep transition-[translate,box-shadow] duration-75 group-hover:from-white still:transition-none ${KEY[size]}`}
      >
        C
      </kbd>
      <span>{state.status === 'copied' ? 'Copied' : label}</span>
    </button>
  )
}
