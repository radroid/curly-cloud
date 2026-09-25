'use client'

import { Fragment } from 'react'
import type { CitationSource } from '@/lib/rag/types'

/**
 * Renders a streamed answer: paragraphs, simple lists, **bold**, `code`, and [n] citation
 * chips. Deliberately tiny and React-only (no HTML injection) since the text is model output.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\d{1,2}\])/g
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/

interface Props {
  text: string
  sources: CitationSource[]
  activeN: number | null
  onCite: (n: number) => void
  onHoverCite?: (n: number | null) => void
}

export function AnswerText({ text, sources, activeN, onCite, onHoverCite }: Props) {
  const known = new Set(sources.map((s) => s.n))
  const inline = (line: string, key: string) =>
    line.split(INLINE).map((part, i) => {
      if (!part) return null
      const k = `${key}-${i}`
      const cite = /^\[(\d{1,2})\]$/.exec(part)
      if (cite) {
        const n = Number(cite[1])
        if (!known.has(n)) return null
        const source = sources.find((s) => s.n === n)
        return (
          <button
            key={k}
            type="button"
            onClick={() => onCite(n)}
            onMouseEnter={() => onHoverCite?.(n)}
            onMouseLeave={() => onHoverCite?.(null)}
            onFocus={() => onHoverCite?.(n)}
            onBlur={() => onHoverCite?.(null)}
            aria-label={`Source ${n}: ${source?.title ?? ''}`}
            className={[
              'mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded px-1 align-middle font-mono text-[0.7rem] font-medium leading-none transition-colors',
              activeN === n ? 'bg-coral text-white' : 'bg-coral/10 text-coral hover:bg-coral hover:text-white',
            ].join(' ')}
          >
            {n}
          </button>
        )
      }
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={k} className="font-semibold">{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`'))
        return (
          <code key={k} className="rounded bg-rule/50 px-1 font-mono text-[0.85em]">
            {part.slice(1, -1)}
          </code>
        )
      return <Fragment key={k}>{part}</Fragment>
    })

  const blocks = text.trim().split(/\n{2,}/)
  return (
    <div className="space-y-3">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim())
        if (lines.length && lines.every((l) => LIST_ITEM.test(l))) {
          const ordered = /^\s*\d/.test(lines[0])
          const List = ordered ? 'ol' : 'ul'
          return (
            <List key={bi} className={`space-y-1.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}>
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(LIST_ITEM, ''), `${bi}-${li}`)}</li>
              ))}
            </List>
          )
        }
        const heading = /^#{1,4}\s+(.*)$/.exec(block)
        if (heading) return <p key={bi} className="font-semibold">{inline(heading[1], `${bi}`)}</p>
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
