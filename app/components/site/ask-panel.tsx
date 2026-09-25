'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAnswer } from '@/lib/client/sse'
import type { ChatTurn, CitationSource } from '@/lib/rag/types'
import { RESUME } from '@/content/resume'
import { topicLabel } from '@/content/topics'
import { useMediaQuery } from '@/app/lib/use-media-query'
import { AnswerText } from './answer-text'
import { useSite } from './site-context'

// ── Chat state ───────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: CitationSource[]
  cited?: number[]
  status?: 'streaming' | 'done' | 'stopped' | 'error'
  error?: { code: string; message: string }
  meta?: { provider: string; model: string; latencyMs: number; guarded: boolean }
}

const STORAGE_KEY = 'raj-clone-chat-v1'
const MAX_QUESTION = 1000
const MAX_TURNS = 12

const ERROR_COPY: Record<string, string> = {
  rate_limited: 'You’ve asked a lot in a short time. Give it a little while, or email me directly.',
  budget_exceeded: 'The clone has used up today’s budget. It resets at midnight UTC — or email me directly.',
  unavailable: 'The clone is offline right now. Try again in a minute, or email me directly.',
}

function modelLabel(model: string): string {
  if (model.startsWith('claude-')) {
    return model
      .replace(/^claude-/, 'Claude ')
      .replace(/-(\d+)-(\d+)$/, ' $1.$2')
      .replace(/-(\d+)$/, ' $1')
      .replace(/(^|\s)([a-z])/g, (_, s, c) => s + c.toUpperCase())
  }
  const tail = model.split('/').pop() ?? model
  if (tail.startsWith('llama-4-scout')) return 'Llama 4 Scout'
  return tail
}

function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const { setCitedFromAnswer, clearCited } = useSite()

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) setMessages(JSON.parse(saved) as Message[])
    } catch {
      // Corrupt storage: start fresh.
    }
  }, [])

  useEffect(() => {
    if (busy) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      // Storage full or disabled; the chat still works for this page view.
    }
  }, [messages, busy])

  const patch = (id: string, update: (m: Message) => Message) =>
    setMessages((all) => all.map((m) => (m.id === id ? update(m) : m)))

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_QUESTION)
      if (!question || controller.current) return
      const history: ChatTurn[] = messages
        .filter((m) => m.role === 'user' || m.status === 'done' || m.status === 'stopped')
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }))
      const turns: ChatTurn[] = [...history, { role: 'user' as const, content: question }].slice(-MAX_TURNS)
      if (turns[0]?.role === 'assistant') turns.shift()

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: question }
      const reply: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', status: 'streaming' }
      setMessages((all) => [...all, userMsg, reply])
      setBusy(true)
      clearCited()
      const ac = new AbortController()
      controller.current = ac
      let sources: CitationSource[] = []
      try {
        for await (const ev of streamAnswer('/api/chat', { messages: turns, channel: 'web' }, ac.signal)) {
          if (ev.type === 'sources') {
            sources = ev.sources
            patch(reply.id, (m) => ({ ...m, sources: ev.sources }))
          } else if (ev.type === 'delta') patch(reply.id, (m) => ({ ...m, content: m.content + ev.text }))
          else if (ev.type === 'done') {
            setCitedFromAnswer(sources, ev.cited)
            patch(reply.id, (m) => ({
              ...m,
              status: 'done',
              cited: ev.cited,
              meta: { provider: ev.provider, model: ev.model, latencyMs: ev.latencyMs, guarded: ev.guarded },
            }))
          } else if (ev.type === 'error') {
            patch(reply.id, (m) => ({ ...m, status: 'error', error: { code: ev.code, message: ev.message } }))
          }
        }
        patch(reply.id, (m) => (m.status === 'streaming' ? { ...m, status: m.content ? 'stopped' : 'error', error: m.content ? undefined : { code: 'unavailable', message: '' } } : m))
      } catch (err) {
        const aborted = (err as Error)?.name === 'AbortError'
        patch(reply.id, (m) =>
          aborted ? { ...m, status: 'stopped' } : { ...m, status: 'error', error: { code: 'unavailable', message: '' } },
        )
      } finally {
        controller.current = null
        setBusy(false)
      }
    },
    [messages, clearCited, setCitedFromAnswer],
  )

  const stop = useCallback(() => controller.current?.abort(), [])
  const reset = useCallback(() => {
    controller.current?.abort()
    setMessages([])
    clearCited()
  }, [clearCited])

  return { messages, busy, send, stop, reset }
}

// ── Panel ────────────────────────────────────────────────────────────────────

const STARTERS = [
  'What are you building at Eddy right now?',
  'How do you know a RAG system is actually good?',
  'Tell me about a time you recommended not shipping something.',
  'What kind of team do you want to join next?',
  'How do you use Claude Code day to day?',
]

/**
 * The clone. One instance: a sticky column on desktop, a bottom sheet on mobile.
 */
export function AskPanel() {
  const site = useSite()
  const { messages, busy, send, stop, reset } = useChat()
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const isDesktop = useMediaQuery('(min-width: 1024px)', true)
  const sheet = !isDesktop

  // Requests from the rest of the page ("Ask about this", hero buttons).
  const handled = useRef(0)
  useEffect(() => {
    const r = site.request
    if (!r || r.id === handled.current) return
    handled.current = r.id
    if (r.send && r.question) void send(r.question)
    else {
      if (r.question) setInput(r.question)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), sheet ? 300 : 0)
    }
  }, [site.request, send, sheet])

  // "/" focuses the question box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      site.focusAsk()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [site])

  // Follow the stream unless the reader scrolled up.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  // Sheet: focus moves in on open and back on close; Escape closes.
  const panelRef = useRef<HTMLElement>(null)
  const { sheetOpen, setSheetOpen } = site
  useEffect(() => {
    if (!sheet || !sheetOpen) return
    const previous = document.activeElement as HTMLElement | null
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true })
    }
  }, [sheet, sheetOpen, setSheetOpen])

  const submit = () => {
    if (!input.trim() || busy) return
    stickToBottom.current = true
    void send(input)
    setInput('')
  }

  const open = !sheet || site.sheetOpen

  return (
    <>
      {sheet && (
        <div
          aria-hidden
          onClick={() => site.setSheetOpen(false)}
          className={`fixed inset-0 z-40 bg-ink/30 transition-opacity lg:hidden ${site.sheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        />
      )}
      <section
        ref={panelRef}
        tabIndex={-1}
        aria-label="Ask Raj’s AI clone"
        role={sheet ? 'dialog' : 'complementary'}
        aria-modal={sheet ? true : undefined}
        inert={!open}
        className={[
          'flex flex-col bg-white outline-none',
          'fixed inset-x-0 bottom-0 z-50 h-[88dvh] rounded-t-2xl border-t border-rule shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.25)] transition-transform duration-300',
          site.sheetOpen ? 'translate-y-0' : 'translate-y-full',
          'lg:static lg:z-auto lg:h-full lg:translate-y-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none',
        ].join(' ')}
      >
        <PanelHeader onReset={messages.length ? reset : undefined} onClose={sheet ? () => site.setSheetOpen(false) : undefined} />

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
          }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
          aria-live="polite"
          aria-busy={busy}
        >
          {messages.length === 0 ? (
            <EmptyState onPick={(q) => void send(q)} />
          ) : (
            <ol className="space-y-6">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <li key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-[0.95rem] text-paper">{m.content}</p>
                  </li>
                ) : (
                  <li key={m.id}>
                    <AssistantMessage message={m} />
                  </li>
                ),
              )}
            </ol>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="border-t border-rule p-3 sm:p-4"
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask Raj’s AI clone a question
          </label>
          <div className="flex items-end gap-2 rounded-xl border border-rule bg-paper/60 p-1.5 focus-within:border-forest">
            <textarea
              id="ask-input"
              ref={inputRef}
              value={input}
              maxLength={MAX_QUESTION}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask me anything…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.95rem] outline-none placeholder:text-muted"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-rule bg-white px-3 text-sm font-medium hover:border-ink"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-9 shrink-0 items-center rounded-lg bg-forest px-3.5 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:bg-rule disabled:text-muted"
              >
                Ask
              </button>
            )}
          </div>
          <p className="mt-2 flex items-center justify-between gap-3 px-1 text-xs text-muted">
            <span>
              An AI clone — it can be wrong. Questions are logged, never your IP.{' '}
              <a href="#privacy" className="underline underline-offset-2 hover:text-ink" onClick={() => site.setSheetOpen(false)}>
                More
              </a>
            </span>
            {input.length > MAX_QUESTION - 200 && (
              <span className="shrink-0 font-mono tabular-nums">
                {input.length}/{MAX_QUESTION}
              </span>
            )}
          </p>
        </form>
      </section>
    </>
  )
}

function PanelHeader({ onReset, onClose }: { onReset?: () => void; onClose?: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-rule px-4 py-3 sm:px-5">
      {onClose && <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-rule lg:hidden" />}
      <div className="relative">
        <Image src="/raj-avatar.webp" alt="" width={36} height={36} className="size-9 rounded-full" />
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-forest" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-tight">Ask Raj</h2>
        <p className="truncate text-xs text-muted">AI clone · answers from my resume and my own words</p>
      </div>
      {onReset && (
        <button type="button" onClick={onReset} className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-paper hover:text-ink">
          New chat
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      )}
    </header>
  )
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div>
      <p className="text-[0.95rem] leading-relaxed">
        Hi — I’m an AI version of Raj. I answer from his resume and from interview questions he’s answered in his own words, and I cite
        where each answer comes from. <span className="text-muted">Cited resume lines light up <span className="lg:hidden">in the resume</span><span className="max-lg:hidden">on the left</span>.</span>
      </p>
      <p className="mt-5 font-mono text-[0.7rem] uppercase tracking-wider text-muted">Try asking</p>
      <ul className="mt-2 space-y-1.5">
        {STARTERS.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-left text-sm transition-colors hover:border-forest hover:bg-paper"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted max-lg:hidden">
        Tip: press <kbd className="rounded border border-rule bg-paper px-1 font-mono">/</kbd> anywhere to ask.
      </p>
    </div>
  )
}

function AssistantMessage({ message: m }: { message: Message }) {
  const { focusAnchor } = useSite()
  const [activeN, setActiveN] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)
  const sources = m.sources ?? []
  const cited = m.cited ?? []
  const listed = showAll || !cited.length ? sources : cited.map((n) => sources.find((s) => s.n === n)).filter((s): s is CitationSource => !!s)

  const onCite = (n: number) => {
    const s = sources.find((x) => x.n === n)
    if (s?.visibility === 'public' && s.anchor) focusAnchor(s.anchor)
    setActiveN(n)
    setTimeout(() => setActiveN((cur) => (cur === n ? null : cur)), 2400)
  }

  if (m.status === 'error') {
    return (
      <div className="rounded-xl border border-coral/30 bg-coral/5 px-3.5 py-3 text-sm">
        <p>{ERROR_COPY[m.error?.code ?? ''] ?? m.error?.message ?? ERROR_COPY.unavailable}</p>
        <a href={`mailto:${RESUME.email}`} className="mt-1 inline-block font-medium text-forest underline underline-offset-2">
          {RESUME.email}
        </a>
      </div>
    )
  }

  return (
    <div className="text-[0.95rem] leading-relaxed">
      {m.content ? (
        <AnswerText text={m.content} sources={sources} activeN={activeN} onCite={onCite} onHoverCite={setActiveN} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-forest" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
          {sources.length ? `Reading ${sources.length} sources…` : 'Searching what I know…'}
        </p>
      )}
      {m.status === 'streaming' && m.content && <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-forest align-text-bottom" />}
      {m.status === 'stopped' && <p className="mt-2 text-xs text-muted">Stopped.</p>}
      {m.meta?.guarded && (
        <p className="mt-2 text-xs text-muted">I stopped early rather than quote my private notes word for word. Ask me to put it differently.</p>
      )}

      {listed.length > 0 && m.status !== 'streaming' && (
        <div className="mt-3 rounded-xl border border-rule bg-paper/60 p-2.5">
          <p className="px-1 font-mono text-[0.68rem] uppercase tracking-wider text-muted">
            {cited.length && !showAll ? 'Sources cited' : 'Sources retrieved'}
          </p>
          <ul className="mt-1.5 space-y-1">
            {listed.map((s) => (
              <li key={s.n}>
                <SourceRow source={s} active={activeN === s.n} onOpen={() => onCite(s.n)} />
              </li>
            ))}
          </ul>
          {cited.length > 0 && sources.length > cited.length && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1.5 px-1 text-xs text-muted underline underline-offset-2 hover:text-ink">
              {showAll ? 'Only cited sources' : `Show all ${sources.length} retrieved`}
            </button>
          )}
        </div>
      )}
      {m.meta && (
        <p className="mt-2 font-mono text-[0.68rem] text-muted">
          {modelLabel(m.meta.model)} · {(m.meta.latencyMs / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  )
}

function SourceRow({ source: s, active, onOpen }: { source: CitationSource; active: boolean; onOpen: () => void }) {
  const isPublic = s.visibility === 'public'
  const label = isPublic ? s.title.replace(/^Resume · /, '') : topicLabel(s.topic)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'flex w-full gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors',
        active ? 'bg-marker/70' : 'hover:bg-white',
      ].join(' ')}
    >
      <span className="mt-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded bg-coral/10 px-1 font-mono text-[0.7rem] text-coral">{s.n}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-xs">
          <span className="font-medium text-ink">{label}</span>
          <span className="text-muted">{isPublic ? (s.kind === 'profile' ? 'Profile' : 'Resume') : 'In my own words'}</span>
          {isPublic && s.anchor && <span className="ml-auto shrink-0 text-forest">Show ↗</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{isPublic ? s.snippet : `“${s.title}”`}</span>
      </span>
    </button>
  )
}
