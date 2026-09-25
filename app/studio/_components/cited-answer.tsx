import { splitCitations } from '@/lib/studio/shared'
import { cx } from '@/app/studio/_components/ui'

/**
 * Renders an answer with its `[n]` markers as small numbered chips linked to the source list
 * (ids `${anchorPrefix}-${n}`). Markers that don't match a known source show in coral: the model
 * cited something it wasn't given.
 */
export function CitedAnswer({ text, titles, anchorPrefix, className }: {
  text: string
  titles: Record<number, string>
  anchorPrefix: string
  className?: string
}) {
  return (
    <div className={cx('whitespace-pre-wrap text-[15px] leading-7 text-ink', className)}>
      {splitCitations(text).map((part, i) => {
        if (part.type === 'text') return <span key={i}>{part.text}</span>
        const title = titles[part.n]
        return (
          <a
            key={i}
            href={`#${anchorPrefix}-${part.n}`}
            title={title ?? 'No source with this number'}
            className={cx(
              'mx-px inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-[3px] px-1 align-[0.12em] font-mono text-[10px] leading-none no-underline',
              title ? 'bg-forest/10 text-forest hover:bg-forest hover:text-white' : 'bg-coral/15 text-coral',
            )}
          >
            {part.n}
          </a>
        )
      })}
    </div>
  )
}
