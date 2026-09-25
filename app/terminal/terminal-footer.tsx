'use client'

import type { SessionMode } from './use-terminal-session'

export type ChipAction =
  | { kind: 'run'; command: string }
  | { kind: 'insert'; text: string }
  | { kind: 'complete' }
  | { kind: 'history' }
  | { kind: 'interrupt' }

interface Chip {
  label: string
  /** Only when the visible label alone is unclear to a screen reader. Always contains the label. */
  name?: string
  action: ChipAction
}

const CHIPS: readonly Chip[] = [
  { label: 'ls', action: { kind: 'run', command: 'ls' } },
  { label: 'cd ..', action: { kind: 'run', command: 'cd ..' } },
  { label: 'cat', name: 'cat: type a file name next', action: { kind: 'insert', text: 'cat ' } },
  { label: 'ask', name: 'ask: type a question next', action: { kind: 'insert', text: 'ask ' } },
  { label: 'learn', action: { kind: 'run', command: 'learn' } },
  { label: 'Tab', name: 'Tab: complete', action: { kind: 'complete' } },
  { label: '↑', name: 'Previous command', action: { kind: 'history' } },
]

const INTERRUPT_CHIP: Chip = { label: 'Ctrl-C', name: 'Ctrl-C: stop', action: { kind: 'interrupt' } }

function enabled(action: ChipAction, mode: SessionMode): boolean {
  if (action.kind === 'interrupt') return mode === 'running' || mode === 'reading'
  if (action.kind === 'history') return mode === 'idle' || mode === 'reading'
  return mode === 'idle'
}

const HINTS: Record<SessionMode, readonly [key: string, meaning: string][]> = {
  booting: [],
  idle: [
    ['Tab', 'complete'],
    ['↑ ↓', 'history'],
    ['Ctrl-C', 'cancel the line'],
    ['Ctrl-L', 'clear'],
  ],
  running: [['Ctrl-C', 'stop the command']],
  reading: [
    ['Enter', 'send'],
    ['Ctrl-C', 'cancel'],
    ['Ctrl-D', 'end input'],
  ],
}

/**
 * Touch: a row of command chips that sits just above the keyboard and never takes focus from the
 * input (so the keyboard stays open). Mouse and keyboard: the keys that matter right now.
 */
export function TerminalFooter({ mode, onChip }: { mode: SessionMode; onChip(action: ChipAction): void }) {
  const busy = mode === 'running' || mode === 'reading'
  const chips = busy ? [INTERRUPT_CHIP, ...CHIPS] : CHIPS

  return (
    <div className="shrink-0 border-t border-white/10 bg-pine">
      <div
        role="group"
        aria-label="Shortcuts"
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-2 [scrollbar-width:none] sm:px-8 sm:pointer-fine:hidden"
      >
        {chips.map((chip) => {
          const disabled = !enabled(chip.action, mode)
          return (
            <button
              key={chip.label}
              type="button"
              aria-label={chip.name}
              aria-disabled={disabled}
              // Keep focus (and the on-screen keyboard) on the input.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                if (!disabled) onChip(chip.action)
              }}
              // Ctrl-C is marked by a coral ring, not coral text: coral text on the chip fill is under 4.5:1.
              className={`flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.06] px-3.5 text-sm text-term-text ring-1 ring-inset transition-colors select-none active:bg-white/[0.14] aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:active:bg-white/[0.06] ${
                chip.action.kind === 'interrupt' ? 'ring-coral/70' : 'ring-white/10'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="mx-auto hidden h-10 w-full max-w-5xl items-center gap-x-6 px-8 text-[12.5px] text-term-dim sm:pointer-fine:flex">
        {HINTS[mode].map(([key, meaning]) => (
          <span key={key} className="flex items-center gap-2">
            <kbd className="rounded-[4px] bg-white/[0.06] px-1.5 py-px font-mono text-[11.5px] text-term-text ring-1 ring-white/15 ring-inset">
              {key}
            </kbd>
            {meaning}
          </span>
        ))}
      </div>
    </div>
  )
}
