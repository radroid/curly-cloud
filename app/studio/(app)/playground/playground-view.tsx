'use client'

import Link from 'next/link'
import { Fragment, useRef, useState, type FormEvent } from 'react'
import { CitedAnswer } from '@/app/studio/_components/cited-answer'
import { btn, cx, Eyebrow, KindMark, Notice, PageHeader, Panel, select, Spinner, Tag, textarea, VisibilityMark } from '@/app/studio/_components/ui'
import { studio, type ApiFailure } from '@/lib/studio/api'
import { fmtMs, fmtScore, truncate } from '@/lib/studio/shared'
import type { Answer, RetrievedChunk } from '@/lib/studio/types'

const EXAMPLES = [
  'What are you building right now?',
  'How do you evaluate a RAG system?',
  'Why would you be a good fit for an AI engineer role?',
  'What’s a dealbreaker for you in a new job?',
]

type Result<T> = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error'; error: ApiFailure }

function Unavailable({ error, route }: { error: ApiFailure; route: string }) {
  if (error.missing) {
    return (
      <Notice tone="warn" title="Not in this build yet">
        <code>{route}</code> lands with the RAG stream. The playground lights up once it’s merged.
      </Notice>
    )
  }
  return (
    <Notice tone={error.status === 503 ? 'warn' : 'error'} title={`Failed (${error.status || 'network'})`}>
      {error.message}
    </Notice>
  )
}

export function PlaygroundView() {
  const [question, setQuestion] = useState('')
  const [k, setK] = useState(12)
  const [answer, setAnswer] = useState<Result<Answer>>({ state: 'idle' })
  const [chunks, setChunks] = useState<Result<RetrievedChunk[]>>({ state: 'idle' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const inflight = useRef<AbortController | null>(null)

  async function ask(e?: FormEvent) {
    e?.preventDefault()
    const q = question.trim()
    if (!q) return
    inflight.current?.abort()
    const ac = new AbortController()
    inflight.current = ac
    setAnswer({ state: 'loading' })
    setChunks({ state: 'loading' })
    setExpanded(null)
    const run = async <T,>(call: Promise<{ ok: true; data: T } | ApiFailure>, set: (r: Result<T>) => void) => {
      try {
        const res = await call
        if (!ac.signal.aborted) set(res.ok ? { state: 'ok', data: res.data } : { state: 'error', error: res })
      } catch {
        // aborted by a newer question
      }
    }
    await Promise.all([
      run(studio.debug.answer(q, ac.signal), setAnswer),
      run(
        studio.debug.retrieve(q, k, ac.signal).then((r) => (r.ok ? { ...r, data: r.data.chunks } : r)),
        setChunks,
      ),
    ])
  }

  const busy = answer.state === 'loading' || chunks.state === 'loading'

  return (
    <>
      <PageHeader
        index="05"
        section="Playground"
        title="Ask the clone, see why"
        description="The answer next to exactly what retrieval found, with every score. Private text is visible here and only here. Questions are logged on the studio channel."
      />

      <form onSubmit={ask} className="rounded-lg border border-rule bg-white p-3">
        <label htmlFor="pg-question" className="sr-only">
          Question
        </label>
        <textarea
          id="pg-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask()
          }}
          rows={3}
          maxLength={1000}
          placeholder="Ask what a recruiter or an agent would ask…"
          className={cx(textarea, 'border-0 px-1 text-[15px] focus:ring-0 md:text-[15px]')}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="max-w-full truncate rounded-full border border-rule px-2.5 py-1 text-xs text-muted hover:border-forest/50 hover:text-forest"
              >
                {ex}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted">
            k
            <select value={k} onChange={(e) => setK(Number(e.target.value))} className={cx(select, 'h-8')}>
              {[6, 8, 12, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btn.primary} disabled={!question.trim() || busy}>
            {busy ? (
              <>
                <Spinner /> Asking…
              </>
            ) : (
              <>
                Ask <span className="hidden font-mono text-[11px] opacity-70 sm:inline">⌘↵</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Answer" meta={answer.state === 'ok' ? `${answer.data.provider} · ${fmtMs(answer.data.latencyMs)}` : undefined} className="self-start">
          <AnswerPane result={answer} />
        </Panel>
        <Panel
          title="Retrieval"
          meta={chunks.state === 'ok' ? `${chunks.data.length} chunks · k=${k}` : undefined}
          bodyClassName={chunks.state === 'ok' && chunks.data.length ? 'p-0' : 'p-4'}
          className="self-start"
        >
          {chunks.state === 'idle' ? <p className="text-sm text-muted">Hybrid retrieval (BM25 ∥ dense → RRF → rerank) shows up here.</p> : null}
          {chunks.state === 'loading' ? (
            <p className="text-sm text-muted">
              <Spinner className="mr-2" /> Retrieving…
            </p>
          ) : null}
          {chunks.state === 'error' ? <Unavailable error={chunks.error} route="/api/admin/debug/retrieve" /> : null}
          {chunks.state === 'ok' ? (
            chunks.data.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-paper/60 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
                      <th className="px-3 py-2 font-normal">#</th>
                      <th className="px-3 py-2 font-normal">Source</th>
                      <th className="px-2 py-2 text-right font-normal" title="Rank in BM25 (FTS5)">bm25#</th>
                      <th className="px-2 py-2 text-right font-normal" title="Rank by dense cosine">dense#</th>
                      <th className="px-2 py-2 text-right font-normal" title="Dense cosine similarity">cos</th>
                      <th className="px-2 py-2 text-right font-normal" title="Reciprocal rank fusion">rrf</th>
                      <th className="px-3 py-2 text-right font-normal" title="Cross-encoder rerank score">rerank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunks.data.map((c, i) => {
                      const open = expanded === c.chunkId
                      return (
                        <Fragment key={c.chunkId}>
                          <tr
                            onClick={() => setExpanded(open ? null : c.chunkId)}
                            className={cx('cursor-pointer border-b border-rule align-top hover:bg-paper', open && 'bg-marker/25 hover:bg-marker/35')}
                          >
                            <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted">{i + 1}</td>
                            <td className="px-3 py-2">
                              <button type="button" aria-expanded={open} className="block max-w-[26rem] text-left">
                                <span className="block truncate text-ink">{c.title}</span>
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
                                  <KindMark kind={c.kind} />
                                  <VisibilityMark visibility={c.visibility} />
                                  <span className="truncate font-mono text-[10.5px] text-muted">{c.chunkId}</span>
                                </span>
                              </button>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">{c.scores.bm25Rank ?? '—'}</td>
                            <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">{c.scores.denseRank ?? '—'}</td>
                            <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">{fmtScore(c.scores.dense, 3)}</td>
                            <td className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">{fmtScore(c.scores.rrf, 4)}</td>
                            <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-forest">{fmtScore(c.scores.rerank, 3)}</td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-rule bg-paper/50">
                              <td />
                              <td colSpan={6} className="px-3 pb-3 pt-1">
                                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{c.text}</p>
                                <Link href={`/studio/knowledge?open=${encodeURIComponent(c.sourceId)}`} className="mt-2 inline-block font-mono text-[11px] text-forest hover:underline">
                                  open {c.sourceId} →
                                </Link>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">Nothing retrieved. The knowledge base may be empty for this topic.</p>
            )
          ) : null}
        </Panel>
      </div>
    </>
  )
}

function AnswerPane({ result }: { result: Result<Answer> }) {
  if (result.state === 'idle') return <p className="text-sm text-muted">Ask something to see the answer, its citations and how long it took.</p>
  if (result.state === 'loading') {
    return (
      <p className="text-sm text-muted">
        <Spinner className="mr-2" /> Thinking as Raj…
      </p>
    )
  }
  if (result.state === 'error') return <Unavailable error={result.error} route="/api/admin/debug/answer" />
  const a = result.data
  const titles: Record<number, string> = {}
  for (const s of a.sources) titles[s.n] = s.title
  const cited = new Set(a.cited)
  return (
    <div className="space-y-4">
      {a.guarded ? <Notice tone="error">The verbatim guard cut this answer short.</Notice> : null}
      <CitedAnswer text={a.text} titles={titles} anchorPrefix="pg" />
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-rule pt-3 font-mono text-[11px] text-muted">
        <span>{a.provider}</span>
        <span className="max-w-[18rem] truncate">{a.model}</span>
        <span>{fmtMs(a.latencyMs)}</span>
        {a.guarded ? <Tag tone="coral">guarded</Tag> : <span>not guarded</span>}
        {a.logId ? (
          <Link href={`/studio/logs?open=${encodeURIComponent(a.logId)}`} className="text-forest hover:underline">
            log →
          </Link>
        ) : null}
      </div>
      {a.sources.length ? (
        <div>
          <Eyebrow>Sources</Eyebrow>
          <ol className="mt-1 divide-y divide-rule">
            {a.sources.map((s) => (
              <li key={s.n} id={`pg-${s.n}`} className="grid scroll-mt-4 grid-cols-[2rem_minmax(0,1fr)] gap-x-2 py-2 target:bg-marker/40">
                <span className={cx('pt-0.5 font-mono text-[11px]', cited.has(s.n) ? 'text-forest' : 'text-muted')}>[{s.n}]</span>
                <span className="min-w-0">
                  <Link href={`/studio/knowledge?open=${encodeURIComponent(s.id)}`} className="text-sm text-ink hover:underline">
                    {s.title}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3">
                    <KindMark kind={s.kind} />
                    <VisibilityMark visibility={s.visibility} />
                    {!cited.has(s.n) ? <span className="font-mono text-[10.5px] text-muted">not cited</span> : null}
                  </span>
                  {s.snippet ? <span className="mt-1 block text-xs leading-relaxed text-muted">{truncate(s.snippet, 220)}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
