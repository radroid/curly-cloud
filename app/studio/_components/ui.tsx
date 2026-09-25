/**
 * Presentational building blocks for the studio. No hooks, so server and client components
 * can both use them. The look: a quiet ledger. Hairline rules, mono numerals, colour only
 * as small marks beside ink text.
 */
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import type { Channel, SourceKind, Visibility } from '@/lib/rag/types'

/** Join classes; later ones win conflicts (`cx(btn.primary, 'h-11')`). */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(' '))
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function PageHeader({ index, section, title, description, actions }: {
  index: string
  section: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule pb-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          <span className="text-forest">{index}</span> · {section}
        </p>
        <h1 className="mt-1 text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function Panel({ title, meta, children, className, bodyClassName, actions }: {
  title?: ReactNode
  meta?: ReactNode
  children: ReactNode
  className?: string
  /** Replaces the default `p-4` body padding. */
  bodyClassName?: string
  actions?: ReactNode
}) {
  return (
    <section className={cx('min-w-0 rounded-lg border border-rule bg-white', className)}>
      {title ? (
        <div className="flex items-baseline justify-between gap-3 border-b border-rule px-4 py-2.5">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink">{title}</h2>
          <div className="flex items-center gap-3">
            {meta ? <span className="font-mono text-[11px] text-muted">{meta}</span> : null}
            {actions}
          </div>
        </div>
      ) : null}
      <div className={bodyClassName ?? 'p-4'}>{children}</div>
    </section>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted', className)}>{children}</p>
}

/** A labelled figure: big mono numeral over a small caps label. */
export function Figure({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'coral' | 'forest' }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <Eyebrow>{label}</Eyebrow>
      <p className={cx('mt-1 font-mono text-2xl tabular-nums leading-none', tone === 'coral' ? 'text-coral' : tone === 'forest' ? 'text-forest' : 'text-ink')}>
        {value}
      </p>
      {note ? <p className="mt-1.5 truncate text-xs text-muted">{note}</p> : null}
    </div>
  )
}

export function Notice({ tone = 'info', title, children, className }: {
  tone?: 'info' | 'warn' | 'error' | 'ok'
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-rule bg-paper text-ink',
    warn: 'border-sun/60 bg-marker/40 text-ink',
    error: 'border-coral/40 bg-coral/[0.06] text-ink',
    ok: 'border-forest/30 bg-forest/[0.06] text-ink',
  }
  const marks = { info: 'bg-muted', warn: 'bg-sun', error: 'bg-coral', ok: 'bg-forest' }
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-md border px-3 py-2.5 text-sm', tones[tone], className)}>
      <span aria-hidden className={cx('mt-1.5 size-1.5 shrink-0 rounded-full', marks[tone])} />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-muted [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-ink">{children}</div> : null}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted">{children}</p>
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]', className)}
    />
  )
}

// ── Controls ─────────────────────────────────────────────────────────────────

const base =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const btn = {
  primary: cx(base, 'bg-forest text-white hover:bg-pine'),
  secondary: cx(base, 'border border-rule bg-white text-ink hover:border-forest/50 hover:text-forest'),
  danger: cx(base, 'border border-coral/40 bg-white text-coral hover:bg-coral hover:text-white'),
  ghost: cx(base, 'text-muted hover:bg-ink/5 hover:text-ink'),
  small: 'h-7 px-2 text-xs',
}

export const input =
  'h-9 w-full min-w-0 rounded-md border border-rule bg-white px-3 text-base text-ink placeholder:text-muted/60 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 md:text-sm'

export const textarea =
  'w-full min-w-0 rounded-md border border-rule bg-white px-3 py-2 text-base leading-relaxed text-ink placeholder:text-muted/60 focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 md:text-sm'

export const select =
  'h-9 min-w-0 rounded-md border border-rule bg-white pl-2.5 pr-8 text-base text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15 md:text-sm'

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

// ── Marks and badges ─────────────────────────────────────────────────────────

const KIND_MARK: Record<SourceKind, string> = {
  resume: 'bg-forest',
  profile: 'border border-forest bg-white',
  interview: 'bg-pine',
  note: 'bg-sun',
  correction: 'bg-coral',
}

export function KindMark({ kind }: { kind: SourceKind | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
      <span aria-hidden className={cx('size-2 shrink-0 rounded-[2px]', kind ? KIND_MARK[kind] : 'bg-rule')} />
      {kind ?? 'unknown'}
    </span>
  )
}

export function VisibilityMark({ visibility }: { visibility: Visibility | null | undefined }) {
  if (!visibility) return <span className="font-mono text-[11px] text-muted">—</span>
  return visibility === 'public' ? (
    <span className="font-mono text-[11px] text-forest">public</span>
  ) : (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted">
      <svg aria-hidden viewBox="0 0 12 12" className="size-2.5 fill-current">
        <path d="M3 5V3.5a3 3 0 0 1 6 0V5h.5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5H3Zm1.2 0h3.6V3.5a1.8 1.8 0 0 0-3.6 0V5Z" />
      </svg>
      private
    </span>
  )
}

const CHANNEL_MARK: Record<Channel, string> = {
  web: 'bg-forest',
  terminal: 'bg-pine',
  mcp: 'bg-sun',
  studio: 'bg-muted',
}

export function ChannelMark({ channel }: { channel: Channel }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
      <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', CHANNEL_MARK[channel])} />
      {channel}
    </span>
  )
}

export function Tag({ tone, children, title }: { tone: 'coral' | 'marker' | 'forest' | 'muted'; children: ReactNode; title?: string }) {
  const tones = {
    coral: 'bg-coral/12 text-coral',
    marker: 'bg-marker text-ink',
    forest: 'bg-forest/10 text-forest',
    muted: 'bg-ink/[0.06] text-muted',
  }
  return (
    <span title={title} className={cx('inline-flex h-5 items-center rounded px-1.5 font-mono text-[10.5px] font-medium', tones[tone])}>
      {children}
    </span>
  )
}
