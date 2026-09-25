'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useDebounced, useUrlState } from '@/app/studio/_components/hooks'
import { ConfirmButton, CopyButton, Drawer } from '@/app/studio/_components/overlays'
import { When } from '@/app/studio/_components/when'
import {
  btn,
  cx,
  Empty,
  Eyebrow,
  Field,
  input,
  KindMark,
  Notice,
  PageHeader,
  select,
  Spinner,
  textarea,
  VisibilityMark,
} from '@/app/studio/_components/ui'
import { TOPICS, topicLabel } from '@/content/topics'
import { studio, type ApiFailure } from '@/lib/studio/api'
import { CORRECTION_PREFIX, SOURCES_PAGE_SIZE, SOURCE_KINDS, fmtDateTime, fmtNum, isReadOnlyKind } from '@/lib/studio/shared'
import type { ImportResult, IngestResult, Page, SourceKind, SourceRecord } from '@/lib/studio/types'

const PAGE_SIZE = SOURCES_PAGE_SIZE

type Panel = { type: 'source'; id: string } | { type: 'new' } | { type: 'import' } | null

interface Initial {
  kind: SourceKind | ''
  topic: string
  q: string
  page: number
  open: string | null
  panel: 'new' | 'import' | null
}

export function KnowledgeView({ initial, initialData }: { initial: Initial; initialData?: Page<SourceRecord> }) {
  const [kind, setKind] = useState<SourceKind | ''>(initial.kind)
  const [topic, setTopic] = useState(initial.topic)
  const [q, setQ] = useState(initial.q)
  const [page, setPage] = useState(initial.page)
  const [panel, setPanel] = useState<Panel>(initial.open ? { type: 'source', id: initial.open } : initial.panel ? { type: initial.panel } : null)
  const [data, setData] = useState<Page<SourceRecord> | null>(initialData ?? null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [loading, setLoading] = useState(!initialData)
  const [reload, setReload] = useState(0)
  const query = useDebounced(q.trim(), 250)
  // The server rendered the first page when lib/rag could; don't fetch it again on mount.
  const skipFirst = useRef(!!initialData)

  useUrlState({
    kind,
    topic,
    q: query,
    page: page > 1 ? page : null,
    open: panel?.type === 'source' ? panel.id : null,
    panel: panel && panel.type !== 'source' ? panel.type : null,
  })

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    const ac = new AbortController()
    setLoading(true)
    studio.sources
      .list({ kind, topic, q: query, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, ac.signal)
      .then((res) => {
        if (res.ok) {
          setData(res.data)
          setError(null)
        } else setError(res)
        setLoading(false)
      })
      .catch(() => {})
    return () => ac.abort()
  }, [kind, topic, query, page, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])
  const close = useCallback(() => setPanel(null), [])
  const total = data?.total ?? 0
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0
  const to = Math.min(total, page * PAGE_SIZE)
  const filtered = !!(kind || topic || query)

  return (
    <>
      <PageHeader
        index="02"
        section="Knowledge"
        title="What the clone knows"
        description="Every source it can retrieve: the public resume, your interview answers, notes and corrections. Private text stays here."
        actions={
          <>
            <button type="button" className={btn.secondary} onClick={() => setPanel({ type: 'import' })}>
              Import answers
            </button>
            <button type="button" className={btn.primary} onClick={() => setPanel({ type: 'new' })}>
              New note
            </button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 fill-none stroke-muted" strokeWidth="1.6">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" />
          </svg>
          <input
            type="search"
            aria-label="Search titles and text"
            placeholder="Search titles and text…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            className={cx(input, 'pl-8')}
          />
        </div>
        <select
          aria-label="Kind"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as SourceKind | '')
            setPage(1)
          }}
          className={select}
        >
          <option value="">All kinds</option>
          {SOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <TopicSelect
          value={topic}
          onChange={(v) => {
            setTopic(v)
            setPage(1)
          }}
          allLabel="All topics"
          ariaLabel="Topic"
        />
        {filtered ? (
          <button
            type="button"
            className={btn.ghost}
            onClick={() => {
              setKind('')
              setTopic('')
              setQ('')
              setPage(1)
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {error ? (
        <Notice tone={error.status === 503 ? 'warn' : 'error'} title={error.status === 503 ? 'Knowledge base not wired up yet' : 'Couldn’t load sources'} className="mb-3">
          {error.message}
        </Notice>
      ) : null}

      <div className={cx('overflow-hidden rounded-lg border border-rule bg-white', error && !data && 'hidden')}>
        <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_9rem_5.5rem_5.5rem_3.5rem] gap-4 border-b border-rule bg-paper/60 px-4 py-2 md:grid">
          {['Title', 'Kind', 'Topic', 'Visibility', 'Updated', 'Chunks'].map((h, i) => (
            <Eyebrow key={h} className={i === 5 ? 'text-right' : undefined}>
              {h}
            </Eyebrow>
          ))}
        </div>
        {loading && !data ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            <Spinner className="mr-2" /> Loading…
          </p>
        ) : data && data.items.length ? (
          <ul className={cx('divide-y divide-rule', loading && 'opacity-60')}>
            {data.items.map((s) => {
              const active = panel?.type === 'source' && panel.id === s.id
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setPanel({ type: 'source', id: s.id })}
                    className={cx(
                      'grid w-full grid-cols-1 gap-1 px-4 py-2.5 text-left hover:bg-paper md:grid-cols-[minmax(0,1fr)_6.5rem_9rem_5.5rem_5.5rem_3.5rem] md:items-center md:gap-4',
                      active && 'bg-marker/30 hover:bg-marker/40',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{s.title}</span>
                      <span className="block truncate font-mono text-[10.5px] text-muted">{s.id}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 md:contents">
                      <KindMark kind={s.kind} />
                      <span className="truncate text-xs text-muted md:text-[13px] md:text-ink">{topicLabel(s.topic)}</span>
                      <VisibilityMark visibility={s.visibility} />
                      <When at={s.updatedAt} className="font-mono text-[11px] text-muted" />
                      <span className="font-mono text-[11px] tabular-nums text-muted md:text-right md:text-ink">
                        {fmtNum(s.chunkCount)}
                        <span className="md:hidden"> chunks</span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : !error ? (
          <Empty>
            {filtered ? 'Nothing matches these filters.' : 'The knowledge base is empty. Seed the resume (bun run clone:seed), then import your interview answers.'}
          </Empty>
        ) : null}
        {total > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2">
            <p className="font-mono text-[11px] tabular-nums text-muted">
              {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}
            </p>
            <div className="flex gap-1.5">
              <button type="button" className={cx(btn.secondary, btn.small)} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Prev
              </button>
              <button type="button" className={cx(btn.secondary, btn.small)} disabled={to >= total} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Drawer
        open={panel?.type === 'source'}
        onClose={close}
        title="Source"
        eyebrow={<Eyebrow>Knowledge · source</Eyebrow>}
      >
        {panel?.type === 'source' ? (
          <SourceDetail
            key={panel.id}
            id={panel.id}
            onChanged={refresh}
            onDeleted={() => {
              close()
              refresh()
            }}
          />
        ) : null}
      </Drawer>

      <Drawer open={panel?.type === 'new'} onClose={close} title="New note" eyebrow={<Eyebrow>Knowledge · private note</Eyebrow>}>
        <NoteForm
          onCreated={(record) => {
            refresh()
            setPanel({ type: 'source', id: record.id })
          }}
        />
      </Drawer>

      <Drawer open={panel?.type === 'import'} onClose={close} title="Import interview answers" eyebrow={<Eyebrow>Knowledge · import</Eyebrow>}>
        <ImportPanel onImported={refresh} />
      </Drawer>
    </>
  )
}

// ── Topic select ─────────────────────────────────────────────────────────────

function TopicSelect({ value, onChange, allLabel, ariaLabel, id }: {
  value: string
  onChange: (v: string) => void
  allLabel: string
  ariaLabel?: string
  id?: string
}) {
  const known = TOPICS.some((t) => t.id === value)
  return (
    <select id={id} aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} className={select}>
      <option value="">{allLabel}</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      <optgroup label="Interview">
        {TOPICS.filter((t) => t.origin === 'interview').map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Resume">
        {TOPICS.filter((t) => t.origin === 'resume').map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

// ── Source detail / editor ───────────────────────────────────────────────────

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] text-ink">{children}</dd>
    </div>
  )
}

function SourceDetail({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const [record, setRecord] = useState<SourceRecord | null>(null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error' | 'warn'; text: string } | null>(null)

  const load = useCallback((r: SourceRecord) => {
    setRecord(r)
    setTitle(r.title)
    setBody(r.body)
    setTopic(r.topic ?? '')
    setVisibility(r.visibility)
  }, [])

  useEffect(() => {
    studio.sources.get(id).then((res) => (res.ok ? load(res.data) : setError(res)))
  }, [id, load])

  if (error) return <Notice tone={error.status === 503 ? 'warn' : 'error'} title="Couldn’t load this source">{error.message}</Notice>
  if (!record) {
    return (
      <p className="text-sm text-muted">
        <Spinner className="mr-2" /> Loading…
      </p>
    )
  }

  const readOnly = isReadOnlyKind(record.kind)
  const dirty = title !== record.title || body !== record.body || (topic || null) !== (record.topic || null) || visibility !== record.visibility
  const logId = record.kind === 'correction' ? (typeof record.meta.logId === 'string' ? record.meta.logId : record.id.slice(CORRECTION_PREFIX.length)) : null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!record || !dirty) return
    setSaving(true)
    setNotice(null)
    const res = await studio.sources.update(record.id, {
      title: title !== record.title ? title : undefined,
      body: body !== record.body ? body : undefined,
      topic: (topic || null) !== (record.topic || null) ? topic || null : undefined,
      visibility: visibility !== record.visibility ? visibility : undefined,
    })
    setSaving(false)
    if (res.ok) {
      load(res.data)
      setNotice({ tone: 'ok', text: `Saved and re-indexed · ${res.data.chunkCount} chunk${res.data.chunkCount === 1 ? '' : 's'}.` })
      onChanged()
    } else setNotice({ tone: 'error', text: res.message })
  }

  async function remove() {
    if (!record) return
    setDeleting(true)
    const res = await studio.sources.remove(record.id)
    setDeleting(false)
    if (res.ok) onDeleted()
    else setNotice({ tone: 'error', text: res.message })
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-rule bg-white p-3 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-3">
          <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">Id</dt>
          <dd className="mt-0.5 flex items-center gap-2">
            <code className="min-w-0 truncate font-mono text-[12px] text-ink">{record.id}</code>
            <CopyButton text={record.id} label="Copy id" />
          </dd>
        </div>
        <Meta label="Kind">
          <KindMark kind={record.kind} />
        </Meta>
        <Meta label="Visibility">
          <VisibilityMark visibility={record.visibility} />
        </Meta>
        <Meta label="Chunks">
          <span className="font-mono">{fmtNum(record.chunkCount)}</span>
        </Meta>
        <Meta label="Updated">{fmtDateTime(record.updatedAt)}</Meta>
        <Meta label="Created">{fmtDateTime(record.createdAt)}</Meta>
        <Meta label="Hash">
          <span className="font-mono text-[11px]">{record.contentHash ? record.contentHash.slice(0, 12) : '—'}</span>
        </Meta>
        {record.anchor ? (
          <Meta label="On the site">
            <a href={`/#${record.anchor}`} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-forest hover:underline">
              #{record.anchor} ↗
            </a>
          </Meta>
        ) : null}
        {logId ? (
          <Meta label="From">
            <Link href={`/studio/logs?open=${encodeURIComponent(logId)}`} className="text-forest hover:underline">
              the conversation →
            </Link>
          </Meta>
        ) : null}
      </dl>

      {readOnly ? (
        <>
          <Notice tone="info" title="Read-only">
            Resume and profile sources are generated from <code>content/resume.ts</code>. To change this one, edit content/resume.ts and re-seed (
            <code>bun run clone:seed</code>).
          </Notice>
          <div>
            <Eyebrow>{record.title}</Eyebrow>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-rule bg-white p-3 text-sm leading-relaxed text-ink">{record.body}</p>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <Field label={record.kind === 'interview' ? 'Question (citation label)' : 'Title (citation label)'} htmlFor="src-title">
            <input id="src-title" value={title} onChange={(e) => setTitle(e.target.value)} className={input} maxLength={300} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Topic" htmlFor="src-topic">
              <TopicSelect id="src-topic" value={topic} onChange={setTopic} allLabel="General (no topic)" />
            </Field>
            <Field
              label="Visibility"
              htmlFor="src-vis"
              hint={visibility === 'public' && record.visibility !== 'public' ? 'Public sources can be quoted verbatim on the site and over MCP.' : undefined}
            >
              <select id="src-vis" value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'private')} className={cx(select, 'w-full')}>
                <option value="private">private</option>
                <option value="public">public</option>
              </select>
            </Field>
          </div>
          <Field label={record.kind === 'interview' ? 'Your answer' : 'Text'} htmlFor="src-body" hint={`${fmtNum(body.length)} characters`}>
            <textarea id="src-body" value={body} onChange={(e) => setBody(e.target.value)} rows={14} className={textarea} maxLength={20_000} required />
          </Field>
          {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
            <ConfirmButton label="Delete" confirmLabel="Delete for good" onConfirm={remove} busy={deleting} />
            <div className="flex items-center gap-2">
              {dirty ? (
                <button type="button" className={btn.ghost} onClick={() => load(record)}>
                  Revert
                </button>
              ) : null}
              <button type="submit" className={btn.primary} disabled={!dirty || saving}>
                {saving ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : (
                  'Save & re-index'
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {Object.keys(record.meta ?? {}).length ? (
        <details className="rounded-md border border-rule bg-white">
          <summary className="cursor-pointer px-3 py-2 font-mono text-[11px] text-muted">meta</summary>
          <pre className="overflow-x-auto border-t border-rule px-3 py-2 font-mono text-[11px] leading-5 text-ink">{JSON.stringify(record.meta, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  )
}

// ── New note ─────────────────────────────────────────────────────────────────

function NoteForm({ onCreated }: { onCreated: (record: SourceRecord) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('notes')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await studio.sources.create({ title: title.trim(), body: body.trim(), topic: topic || null })
    setBusy(false)
    if (res.ok) onCreated(res.data)
    else setError(res.message)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Anything you want the clone to know in your own words. Notes are private: the clone can use them, visitors never see the text.
      </p>
      <Field label="Title (what it answers)" htmlFor="note-title" hint="Shown as the citation label, so phrase it like a question or a topic.">
        <input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} className={input} maxLength={300} required placeholder="e.g. Why I left agency work" />
      </Field>
      <Field label="Topic" htmlFor="note-topic">
        <TopicSelect id="note-topic" value={topic} onChange={setTopic} allLabel="General (no topic)" />
      </Field>
      <Field label="Text" htmlFor="note-body">
        <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={textarea} maxLength={20_000} required />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex justify-end border-t border-rule pt-4">
        <button type="submit" className={btn.primary} disabled={busy || !title.trim() || !body.trim()}>
          {busy ? (
            <>
              <Spinner /> Adding…
            </>
          ) : (
            'Add to knowledge base'
          )}
        </button>
      </div>
    </form>
  )
}

// ── Import ───────────────────────────────────────────────────────────────────

interface Picked {
  name: string
  size: number
  text: string
  answers: number | null
  version: unknown
  exportedAt: unknown
  parseError: string | null
}

function fmtBytes(n: number): string {
  return n < 1024 ? `${fmtNum(n)} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
}

function inspect(name: string, size: number, text: string): Picked {
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    const answers = Array.isArray(json?.answers) ? json.answers.length : Array.isArray(json) ? json.length : null
    return { name, size, text, answers, version: json?.version ?? json?.format ?? null, exportedAt: json?.exportedAt ?? json?.exported_at ?? null, parseError: null }
  } catch (err) {
    return { name, size, text, answers: null, version: null, exportedAt: null, parseError: (err as Error).message }
  }
}

function IngestSummary({ result, answers }: { result: IngestResult; answers?: number }) {
  const cells: [string, number][] = [
    ...(answers != null ? ([['Answers', answers]] as [string, number][]) : []),
    ['Upserted', result.upserted],
    ['Unchanged', result.unchanged],
    ['Deleted', result.deleted],
    ['Chunks', result.chunks],
    ['Embedded', result.embedded],
    ['Corpus', result.corpusVersion],
  ]
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-rule sm:grid-cols-4 [&>div]:bg-white">
        {cells.map(([label, value]) => (
          <div key={label} className="px-3 py-2">
            <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg tabular-nums text-ink">{label === 'Corpus' ? `v${value}` : fmtNum(value)}</dd>
          </div>
        ))}
      </dl>
      {result.errors.length ? (
        <Notice tone="error" title={`${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`}>
          <ul className="mt-1 space-y-0.5">
            {result.errors.slice(0, 20).map((e) => (
              <li key={e.id}>
                <code>{e.id}</code>: {e.message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  )
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [picked, setPicked] = useState<Picked | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<ApiFailure | null>(null)
  const [dragging, setDragging] = useState(false)

  const namedRight = useMemo(() => (picked ? /^raj-clone-answers-.*\.json$/i.test(picked.name) : true), [picked])

  async function pick(file: File | undefined) {
    if (!file) return
    setResult(null)
    setError(null)
    setPicked(inspect(file.name, file.size, await file.text()))
  }

  async function submit() {
    if (!picked || picked.parseError) return
    setBusy(true)
    setError(null)
    const res = await studio.importAnswers(picked.text)
    setBusy(false)
    if (res.ok) {
      setResult(res.data)
      onImported()
    } else setError(res)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Choose a <code className="font-mono text-ink">raj-clone-answers-*.json</code> exported from the interview stack. It’s posted as-is to{' '}
        <code className="font-mono text-ink">/api/admin/import</code>, mapped to private sources and indexed. Re-importing the same file is safe: unchanged answers are skipped.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void pick(e.dataTransfer.files?.[0])
        }}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
          dragging ? 'border-forest bg-forest/[0.05]' : 'border-rule bg-white hover:border-forest/50',
        )}
      >
        <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        <span className="text-sm font-medium text-ink">{picked ? picked.name : 'Choose an export file'}</span>
        <span className="font-mono text-[11px] text-muted">{picked ? fmtBytes(picked.size) : 'or drop it here'}</span>
      </label>

      {picked?.parseError ? <Notice tone="error" title="That file isn’t valid JSON">{picked.parseError}</Notice> : null}
      {picked && !picked.parseError ? (
        <dl className="grid grid-cols-3 gap-3 rounded-md border border-rule bg-white p-3">
          <Meta label="Answers">
            <span className="font-mono">{picked.answers == null ? '?' : fmtNum(picked.answers)}</span>
          </Meta>
          <Meta label="Version">
            <span className="font-mono">{picked.version == null ? '—' : String(picked.version)}</span>
          </Meta>
          <Meta label="Exported">{typeof picked.exportedAt === 'string' || typeof picked.exportedAt === 'number' ? fmtDateTime(new Date(picked.exportedAt).getTime()) : '—'}</Meta>
        </dl>
      ) : null}
      {picked && !picked.parseError && !namedRight ? (
        <Notice tone="warn">The name doesn’t look like an interview export (raj-clone-answers-*.json). The server validates it either way.</Notice>
      ) : null}

      {error ? (
        error.missing ? (
          <Notice tone="warn" title="Import isn’t in this build yet">
            <code>/api/admin/import</code> lands with the interview stream. Until then, load the file from a terminal: <code>bun run clone:ingest {picked?.name ?? '<file>'}</code>.
          </Notice>
        ) : (
          <Notice tone="error" title="Import failed">
            {error.message}
          </Notice>
        )
      ) : null}

      {result ? (
        <div className="space-y-2">
          <Notice tone="ok" title="Imported">
            {fmtNum(result.answers)} answers processed.
          </Notice>
          <IngestSummary result={result.result} answers={result.answers} />
        </div>
      ) : null}

      <div className="flex justify-end border-t border-rule pt-4">
        <button type="button" className={btn.primary} disabled={!picked || !!picked.parseError || busy} onClick={submit}>
          {busy ? (
            <>
              <Spinner /> Importing…
            </>
          ) : picked?.answers != null ? (
            `Import ${fmtNum(picked.answers)} answers`
          ) : (
            'Import'
          )}
        </button>
      </div>
    </div>
  )
}
