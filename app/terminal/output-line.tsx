'use client'

import Link from 'next/link'
import { memo } from 'react'
import type { Line, Segment, SegmentStyle } from '@/lib/shell'

/**
 * Coral on the pine background is only ~3.4:1. Mixing in 30% of the terminal text colour lifts it to
 * ~4.8:1 (WCAG AA) and it still reads as coral. Every other text colour here clears 4.5:1 on pine:
 * term-text ~10:1, term-accent ~8:1, sun ~7:1, term-dim ~5.4:1.
 */
export const CORAL_TEXT = 'text-[color-mix(in_oklab,var(--color-coral)_70%,var(--color-term-text))]'

const STYLE_CLASS: Record<SegmentStyle, string> = {
  plain: 'text-term-text',
  dim: 'text-term-dim',
  accent: 'text-term-accent',
  highlight: 'text-sun',
  strong: 'text-term-text font-medium',
  error: CORAL_TEXT,
  prompt: CORAL_TEXT,
}

export function styleClass(style: SegmentStyle | undefined): string {
  return STYLE_CLASS[style ?? 'plain']
}

const LINK =
  'rounded-[2px] underline decoration-current/40 decoration-1 underline-offset-[3px] transition-colors hover:bg-white/[0.07] hover:decoration-current'

/** Runs a command as if typed. `viaKeyboard` is true for Enter/Space activation (click detail 0). */
export type RunCommand = (command: string, viaKeyboard: boolean) => void

function SegmentView({ segment, onCommand }: { segment: Segment; onCommand: RunCommand }) {
  const style = styleClass(segment.style)
  const link = segment.link
  if (!link) return <span className={style}>{segment.text}</span>

  if (link.kind === 'command') {
    return (
      <button
        type="button"
        className={`${style} ${LINK} cursor-pointer`}
        title={link.command === segment.text.trim() ? undefined : `Runs: ${link.command}`}
        onClick={(event) => onCommand(link.command, event.detail === 0)}
      >
        {segment.text}
      </button>
    )
  }

  if (link.kind === 'route') {
    return (
      <Link href={link.href} className={`${style} ${LINK}`}>
        {segment.text}
      </Link>
    )
  }

  if (link.href.startsWith('mailto:')) {
    return (
      <a href={link.href} className={`${style} ${LINK}`}>
        {segment.text}
      </a>
    )
  }

  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={`${style} ${LINK}`}>
      {segment.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

/** One line of output. Memoised: `appendToLines` keeps finished lines identical, so they never re-render. */
export const OutputLine = memo(function OutputLine({ line, onCommand }: { line: Line; onCommand: RunCommand }) {
  if (!line.length) {
    return (
      <div>
        <br />
      </div>
    )
  }
  return (
    <div className="whitespace-pre-wrap break-words">
      {line.map((segment, i) => (
        <SegmentView key={i} segment={segment} onCommand={onCommand} />
      ))}
    </div>
  )
})

/** The PS1 or a command's own prompt, in front of the input. `break-spaces` keeps the trailing space. */
export function PromptSegments({ id, segments }: { id: string; segments: readonly Segment[] }) {
  return (
    <span id={id} className="max-w-full whitespace-break-spaces break-words">
      {segments.map((segment, i) => (
        <span key={i} className={styleClass(segment.style)}>
          {segment.text}
        </span>
      ))}
    </span>
  )
}
