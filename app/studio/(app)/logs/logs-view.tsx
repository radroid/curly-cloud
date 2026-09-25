'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CitedAnswer } from '@/app/studio/_components/cited-answer'
import { useDebounced, useUrlState } from '@/app/studio/_components/hooks'
import { Drawer } from '@/app/studio/_components/overlays'
import { When } from '@/app/studio/_components/when'
import {
  btn,
  ChannelMark,
  cx,
  Empty,
  Eyebrow,
  input,
  KindMark,
  Notice,
  PageHeader,
  Spinner,
  Tag,
  textarea,
  VisibilityMark,
} from '@/app/studio/_components/ui'
import { studio, type ApiFailure } from '@/lib/studio/api'
import { CHANNELS, LOGS_PAGE_SIZE, correctionText, fmtDateTime, fmtMs, fmtNum, fmtScore, truncate } from '@/lib/studio/shared'
import type { Channel, CorrectionResult, LogDetail, LogItem, LogSourceRef, Page } from '@/lib/studio/types'

const PAGE_SIZE = LOGS_PAGE_SIZE

interface Initial {
  channel: Channel | ''
  flagged: boolean
  q: string
  key: string
  page: number
  open: string | null
}

export function LogsView({ initial, initialData }: { initial: Initial; initialData?: Page<LogItem> }) {
  const [channel, setChannel] = useState<Channel | ''>(initial.channel)
  const [flagged, setFlagged] = useState(initial.flagged)
  const [q, setQ] = useState(initial.q)
  const [key, setKey] = useState(initial.key)
  const [page, setPage] = useState(initial.page)
  const [open, setOpen] = useState<string | null>(initial.open)
  const [data, setData] = useState<Page<LogItem> | null>(initialData ?? null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [loading, setLoading] = useState(!initialData)
  const query = useDebounced(q.trim(), 250)
  // The server rendered the first page; don't fetch it again on mount.
  const skipFirst = useRef(!!initialData)

  useUrlState({ channel, flagged: flagged ? 1 : null, q: query, key, page: page > 1 ? page : null, open })

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    const ac = new AbortController()
    setLoading(true)
    studio.logs
      .list({ channel, flagged: flagged ? true : null, q: query, key, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, ac.signal)
      .then((res) => {
        if (res.ok) {
          setData(res.data)
          setError(null)
        } else setError(res)
        setLoading(false)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [channel, flagged, query, key, page])

  /** Keep the list in step with changes made in the drawer. */
  const patchItem = useCallback((item: LogItem) => {
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, ...item } : i)) } : d))
  }, [])

  const total = data?.total ?? 0
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const to = Math.min(total, page * PAGE_SIZE)
  const reset = (fn: () => void) => {
    fn()
    setPage(1)
  }

  return (
    <>
      <PageHeader
        index="03"
        section="Conversations"
        title="What people asked"
        description="Every question from the site, the terminal, agents over MCP and your playground. Flag weak answers, then correct them: corrections go straight into the knowledge base."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Channel" className="flex overflow-hidden rounded-md border border-rule bg-white">
          {(['', ...CHANNELS] as (Channel | '')[]).map((c) => (
            <button
              key={c || 'all'}
              type="button"
              aria-pressed={channel === c}
              onClick={() => reset(() => setChannel(c))}
              className={cx(
                'h-9 border-r border-rule px-3 font-mono text-[12px] last:border-r-0',
                channel === c ? 'bg-pine text-white' : 'text-muted hover:bg-paper hover:text-ink',
              )}
            >
              {c || 'all'}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={flagged}
          onClick={() => reset(() => setFlagged((f) => !f))}
          className={cx(btn.secondary, flagged && 'border-sun bg-marker text-ink hover:text-ink')}
        >
          <span aria-hidden className={cx('size-2 rounded-full', flagged ? 'bg-coral' : 'bg-rule')} /> Flagged only
        </button>
        <div className="relative min-w-[12rem] flex-1">
          <input
            type="search"
            aria-label="Search questions and answers"
            placeholder="Search questions and answers…"
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
            className={input}
          />
        </div>
        {key ? (
          <button type="button" className={cx(btn.secondary, 'font-mono text-xs')} onClick={() => reset(() => setKey(''))} title="Clear key filter">
            key {key.slice(0, 12)}… ✕
          </button>
        ) : null}
      </div>

      {error ? (
        <Notice tone="error" title="Couldn’t load conversations" className="mb-3">
          {error.message}
        </Notice>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-rule bg-white">
        {loading && !data ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            <Spinner className="mr-2" /> Loading…
          </p>
        ) : data && data.items.length ? (
          <ul className={cx('divide-y divide-rule', loading && 'opacity-60')}>
            {data.items.map((log) => (
              <li key={log.id}>
                <LogRow log={log} active={open === log.id} onOpen={() => setOpen(log.id)} />
              </li>
            ))}
          </ul>
        ) : !error ? (
          <Empty>{channel || flagged || query || key ? 'No conversations match these filters.' : 'No conversations yet.'}</Empty>
        ) : null}
        {total > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2">
            <p className="font-mono text-[11px] tabular-nums text-muted">
              {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}
            </p>
            <div className="flex gap-1.5">
              <button type="button" className={cx(btn.secondary, btn.small)} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Newer
              </button>
              <button type="button" className={cx(btn.secondary, btn.small)} disabled={to >= total} onClick={() => setPage((p) => p + 1)}>
                Older →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title="Conversation" eyebrow={<Eyebrow>Conversations · detail</Eyebrow>} wide>
        {open ? <LogDetailView key={open} id={open} onChange={patchItem} /> : null}
      </Drawer>
    </>
  )
}

function LogRow({ log, active, onOpen }: { log: LogItem; active: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={cx('block w-full px-4 py-3 text-left hover:bg-paper', active && 'bg-marker/30 hover:bg-marker/40')}>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <When at={log.createdAt} className="font-mono text-[11px] tabular-nums text-muted" />
        <ChannelMark channel={log.channel} />
        {log.keyLabel ? <span className="font-mono text-[11px] text-ink">{log.keyLabel}</span> : null}
        {log.kind === 'fit' ? <Tag tone="muted">fit</Tag> : null}
        <span className="ml-auto flex items-center gap-1.5">
          {log.guarded ? <Tag tone="coral" title="The verbatim guard cut this answer short">guarded</Tag> : null}
          {log.flagged ? <Tag tone="marker">flagged</Tag> : null}
          {log.correctionSourceId ? <Tag tone="forest">corrected</Tag> : null}
        </span>
      </span>
      <span className="mt-1.5 block text-[15px] font-medium leading-snug text-ink">{truncate(log.question, 220)}</span>
      <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{log.answer ? truncate(log.answer, 320) : '(no answer)'}</span>
      <span className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-muted">
        <span>{fmtMs(log.latencyMs)}</span>
        {log.provider ? <span>{log.provider}</span> : null}
        {log.model ? <span className="max-w-[16rem] truncate">{log.model}</span> : null}
      </span>
    </button>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────────

function SourceLine({ source, anchor, showScore }: { source: LogSourceRef; anchor?: string; showScore?: boolean }) {
  const title = (
    <span className={cx('min-w-0 text-sm', source.exists ? 'text-ink' : 'text-muted line-through decoration-muted/50')} title={source.exists ? undefined : 'No longer in the knowledge base'}>
      {source.title}
    </span>
  )
  return (
    <li id={anchor} className="grid scroll-mt-4 grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-2 target:bg-marker/40">
      <span className={cx('pt-0.5 font-mono text-[11px] tabular-nums', source.cited ? 'text-forest' : 'text-muted')}>
        {showScore ? fmtScore(source.score, 3) : source.n != null ? `[${source.n}]` : '·'}
      </span>
      <span className="min-w-0">
        {source.exists && source.sourceId ? (
          <Link href={`/studio/knowledge?open=${encodeURIComponent(source.sourceId)}`} className="hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <KindMark kind={source.kind} />
          {source.visibility ? <VisibilityMark visibility={source.visibility} /> : null}
          {!showScore && source.n != null && !source.cited ? <span className="font-mono text-[10.5px] text-muted">not cited</span> : null}
          {!source.exists ? <span className="font-mono text-[10.5px] text-coral">deleted</span> : null}
        </span>
      </span>
    </li>
  )
}

function MetaCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-[12px] text-ink">{children}</dd>
    </div>
  )
}

function LogDetailView({ id, onChange }: { id: string; onChange: (item: LogItem) => void }) {
  const [detail, setDetail] = useState<LogDetail | null>(null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [flagBusy, setFlagBusy] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    studio.logs
      .get(id, ac.signal)
      .then((res) => (res.ok ? setDetail(res.data) : setError(res)))
      .catch(() => {})
    return () => ac.abort()
  }, [id])

  if (error) return <Notice tone="error" title="Couldn’t load this conversation">{error.message}</Notice>
  if (!detail) {
    return (
      <p className="text-sm text-muted">
        <Spinner className="mr-2" /> Loading…
      </p>
    )
  }

  const titles: Record<number, string> = {}
  for (const s of detail.numbered) if (s.n != null) titles[s.n] = s.title

  async function toggleFlag() {
    if (!detail) return
    setFlagBusy(true)
    const res = await studio.logs.flag(detail.id, !detail.flagged)
    setFlagBusy(false)
    if (res.ok) {
      setDetail({ ...detail, ...res.data })
      onChange(res.data)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ChannelMark channel={detail.channel} />
          {detail.keyLabel ? <span className="font-mono text-[11px] text-ink">{detail.keyLabel}</span> : null}
          <span className="font-mono text-[11px] text-muted">{fmtDateTime(detail.createdAt)}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {detail.guarded ? <Tag tone="coral">guarded</Tag> : null}
            {detail.correctionSourceId ? <Tag tone="forest">corrected</Tag> : null}
            <button
              type="button"
              onClick={toggleFlag}
              disabled={flagBusy}
              aria-pressed={detail.flagged}
              className={cx(btn.secondary, btn.small, detail.flagged && 'border-sun bg-marker text-ink hover:text-ink')}
            >
              <span aria-hidden className={cx('size-1.5 rounded-full', detail.flagged ? 'bg-coral' : 'bg-rule')} />
              {detail.flagged ? 'Flagged · unflag' : 'Flag'}
            </button>
          </span>
        </div>
        <Eyebrow className="mt-4">Question</Eyebrow>
        <p className="mt-1 whitespace-pre-wrap text-lg font-medium leading-snug text-ink">{detail.question}</p>
      </section>

      <section>
        <Eyebrow>Answer</Eyebrow>
        {detail.guarded ? (
          <Notice tone="error" className="mt-2">
            The verbatim guard stopped this answer: it started reproducing a private source word for word.
          </Notice>
        ) : null}
        <div className="mt-2 rounded-md border border-rule bg-white p-4">
          {detail.answer ? <CitedAnswer text={detail.answer} titles={titles} anchorPrefix={`n-${detail.id}`} /> : <p className="text-sm text-muted">(no answer)</p>}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <Eyebrow>Sources given to the model</Eyebrow>
          {detail.numbered.length ? (
            <ol className="mt-1 divide-y divide-rule">
              {detail.numbered.map((s, i) => (
                <SourceLine key={`${s.n}-${i}`} source={s} anchor={s.n != null ? `n-${detail.id}-${s.n}` : undefined} />
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">None recorded.</p>
          )}
        </section>
        <section>
          <Eyebrow>Retrieved · best first</Eyebrow>
          {detail.retrievedSources.length ? (
            <ol className="mt-1 divide-y divide-rule">
              {detail.retrievedSources.map((s, i) => (
                <SourceLine key={`${s.sourceId}-${i}`} source={s} showScore />
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted">None recorded.</p>
          )}
        </section>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-rule bg-white p-3 sm:grid-cols-4">
        <MetaCell label="Provider">{detail.provider ?? '—'}</MetaCell>
        <MetaCell label="Model">{detail.model ?? '—'}</MetaCell>
        <MetaCell label="Latency">{fmtMs(detail.latencyMs)}</MetaCell>
        <MetaCell label="Tokens">
          {fmtNum(detail.tokensIn)} → {fmtNum(detail.tokensOut)}
        </MetaCell>
        <MetaCell label="Kind">{detail.kind}</MetaCell>
        <MetaCell label="Client">{detail.clientId}</MetaCell>
        <MetaCell label="Key">{detail.keyId ? `${detail.keyLabel ?? ''} ${detail.keyId}`.trim() : '—'}</MetaCell>
        <MetaCell label="Log id">{detail.id}</MetaCell>
      </dl>

      <CorrectionForm
        detail={detail}
        onCorrected={(res) => {
          setDetail({ ...detail, ...res.log })
          onChange(res.log)
        }}
      />
    </div>
  )
}

function CorrectionForm({ detail, onCorrected }: { detail: LogDetail; onCorrected: (res: CorrectionResult) => void }) {
  const [text, setText] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(!!detail.correctionSourceId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [done, setDone] = useState<CorrectionResult | null>(null)

  // Prefill with the current correction so a second pass edits rather than starts over.
  useEffect(() => {
    if (!detail.correctionSourceId) return
    studio.sources.get(detail.correctionSourceId).then((res) => {
      if (res.ok) setText(correctionText(res.data.body))
      setLoadingExisting(false)
    })
  }, [detail.correctionSourceId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    setDone(null)
    const res = await studio.logs.correct(detail.id, text.trim())
    setBusy(false)
    if (res.ok) {
      setDone(res.data)
      onCorrected(res.data)
    } else setError(res)
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-forest/25 bg-forest/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{detail.correctionSourceId ? 'Your correction' : 'Correct this answer'}</h3>
        {detail.correctionSourceId ? (
          <Link href={`/studio/knowledge?open=${encodeURIComponent(detail.correctionSourceId)}`} className="font-mono text-[11px] text-forest hover:underline">
            {detail.correctionSourceId}
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        Write how you’d actually answer. It’s saved as a private source the clone retrieves next time, and the flag clears.
      </p>
      <label htmlFor={`correction-${detail.id}`} className="sr-only">
        How you’d actually answer
      </label>
      <textarea
        id={`correction-${detail.id}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={8000}
        placeholder={loadingExisting ? 'Loading your earlier correction…' : 'In my own words…'}
        className={cx(textarea, 'mt-3')}
      />
      {error ? (
        <Notice tone={error.status === 503 ? 'warn' : 'error'} title={error.status === 503 ? 'Not saved: the knowledge base isn’t wired up yet' : 'Not saved'} className="mt-3">
          {error.message}
        </Notice>
      ) : null}
      {done ? (
        <Notice tone="ok" title="Added to the knowledge base" className="mt-3">
          Saved as <code>{done.sourceId}</code> · {done.result.upserted ? 'updated' : 'unchanged'} · {fmtNum(done.result.chunks)} chunk
          {done.result.chunks === 1 ? '' : 's'} · corpus v{done.result.corpusVersion}.
        </Notice>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button type="submit" className={btn.primary} disabled={busy || !text.trim()}>
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : detail.correctionSourceId ? (
            'Update correction'
          ) : (
            'Save correction'
          )}
        </button>
      </div>
    </form>
  )
}
