'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAnswer } from '@/lib/client/sse'
import type { ChatTurn, CitationSource } from '@/lib/rag/types'
import { RESUME } from '@/content/resume'
import { topicLabel } from '@/content/topics'
import { motionOff } from '@/app/lib/motion'
import { useMediaQuery } from '@/app/lib/use-media-query'
import { useRenderStatus } from '@/app/lib/use-render-status'
import { AnswerText } from './answer-text'
import { STARS } from './cloud/stars'
import { RESUME_LINE_COUNT } from './resume-helpers'
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
  /** The server's signature over this answer; sent back with it so the clone trusts the turn. */
  sig?: string
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

/**
 * The conversation to send with the next question. Answers go back only with the `sig` the server
 * gave them (the server drops unsigned assistant turns anyway). Exchanges the clone refused or cut
 * short (`guarded`) are left out, so one refused question doesn't turn every later answer into a
 * refusal: the server checks every user turn it receives.
 */
function replayTurns(messages: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user') {
      const reply = messages[i + 1]
      if (reply?.role === 'assistant' && reply.meta?.guarded) {
        i++
        continue
      }
      if (m.content.trim()) turns.push({ role: 'user', content: m.content })
    } else if (m.sig && m.content.trim()) {
      turns.push({ role: 'assistant', content: m.content, sig: m.sig })
    }
  }
  return turns
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
      const turns: ChatTurn[] = [...replayTurns(messages), { role: 'user' as const, content: question }].slice(-MAX_TURNS)
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
              sig: ev.sig,
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

// ── What the clone is doing ──────────────────────────────────────────────────

type CloneState = 'idle' | 'thinking' | 'answering'

const NOD: Keyframe[] = [{ transform: 'none' }, { transform: 'translateY(2px) rotate(-2deg)' }, { transform: 'none' }]
const PULSE: Keyframe[] = [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.3)' }]

/**
 * What the clone is doing, read from the latest reply. The header gets it as a prop; the mobile dock
 * reads it from <html data-clone> with `in-data-[clone=…]:` variants, so the rest of the page doesn't
 * re-render on every token. As text streams in, [data-nod] avatars nod (at most every 220 ms), and an
 * answer that cites sources pulses the [data-pulse] rings once. WAAPI ignores the CSS motion-off rule,
 * so both check motionOff().
 */
function useCloneState(messages: Message[]): CloneState {
  const last = messages[messages.length - 1]
  const streaming = last?.role === 'assistant' && last.status === 'streaming'
  const state: CloneState = streaming ? (last.content ? 'answering' : 'thinking') : 'idle'

  useEffect(() => {
    const root = document.documentElement
    root.dataset.clone = state
    return () => {
      delete root.dataset.clone
    }
  }, [state])

  const lastNod = useRef(0)
  const text = streaming ? last.content : ''
  useEffect(() => {
    const now = performance.now()
    if (!text || now - lastNod.current < 220 || motionOff()) return
    lastNod.current = now
    document.querySelectorAll<HTMLElement>('[data-nod]').forEach((el) => el.animate(NOD, { duration: 180, easing: 'ease-in-out' }))
  }, [text])

  // Only a reply that finishes streaming here pulses, not one restored from history.
  const watching = useRef<string | null>(null)
  useEffect(() => {
    if (streaming) watching.current = last.id
    else if (last && last.id === watching.current) {
      watching.current = null
      if (last.status === 'done' && last.cited?.length && !motionOff()) {
        document.querySelectorAll<HTMLElement>('[data-pulse]').forEach((el) => el.animate(PULSE, { duration: 700, easing: 'ease-out' }))
      }
    }
  }, [streaming, last])

  return state
}

// ── Panel ────────────────────────────────────────────────────────────────────

/** Starter questions. Also cycled in the hero prompt; lib/rag/injection.test.ts reads them from this file. */
export const STARTERS = [
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
  const clone = useCloneState(messages)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
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

  // Height of the scroll area, so the latest answer can reserve room for its question to pin.
  const [viewH, setViewH] = useState(0)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // When a question is sent, pin it to the top of the panel and let the answer grow beneath it
  // (reading from the start beats chasing the stream).
  const lastUserId = [...messages].reverse().find((m) => m.role === 'user')?.id
  const pinned = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!lastUserId || lastUserId === pinned.current) return
    const first = pinned.current === undefined
    pinned.current = lastUserId
    const el = scrollRef.current
    const target = el?.querySelector<HTMLElement>(`[data-msg="${lastUserId}"]`)
    if (!el || !target) return
    // Restored history: jump to the latest exchange without animating.
    el.scrollTo({ top: target.offsetTop - 16, behavior: first || motionOff() ? 'auto' : 'smooth' })
  }, [lastUserId])

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
          'flex flex-col bg-white text-ink outline-none',
          'fixed inset-x-0 bottom-0 z-50 h-[88dvh] rounded-t-[20px] shadow-[0_-16px_40px_-12px_rgb(0_0_0/0.35)] transition-transform duration-300',
          site.sheetOpen ? 'translate-y-0' : 'translate-y-full',
          'lg:static lg:z-auto lg:h-full lg:translate-y-0 lg:rounded-none lg:border-l lg:border-rule lg:shadow-none',
        ].join(' ')}
      >
        <PanelHeader state={clone} onReset={messages.length ? reset : undefined} onClose={sheet ? () => site.setSheetOpen(false) : undefined} />

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-[18px]"
          aria-live="polite"
          aria-busy={busy}
        >
          {messages.length === 0 ? (
            <EmptyState onPick={(q) => void send(q)} />
          ) : (
            <ol className="space-y-5">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <li key={m.id} data-msg={m.id} className="flex justify-end">
                    <p className="max-w-[88%] whitespace-pre-wrap rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-[9px] text-[15px] text-paper">{m.content}</p>
                  </li>
                ) : (
                  <li key={m.id} style={i === messages.length - 1 && viewH ? { minHeight: Math.max(0, viewH - 120) } : undefined}>
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
          className="border-t border-rule p-3"
        >
          <label htmlFor="ask-input" className="sr-only">
            Ask Raj’s AI clone a question
          </label>
          <div className="flex items-end gap-1.5 rounded-xl border border-rule bg-paper p-[5px] transition-colors focus-within:border-forest">
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
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted lg:text-[15px]"
            />
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-10 shrink-0 items-center rounded-[9px] border border-rule bg-white px-4 text-sm font-semibold hover:border-ink"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-10 shrink-0 items-center rounded-[9px] bg-forest px-4 text-sm font-semibold text-paper transition-colors hover:bg-pine disabled:bg-rule disabled:text-muted"
              >
                Ask
              </button>
            )}
          </div>
          <p className="mx-1 mt-2 flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              An AI clone — it can be wrong. Questions are logged, never your IP.{' '}
              <a href="#privacy" className="underline decoration-current/45 underline-offset-4 hover:text-ink hover:decoration-current" onClick={() => site.setSheetOpen(false)}>
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

/** The clone's status, behind the avatar: hover it, tab to it, or tap it. */
function CloneStatus({ open }: { open: boolean }) {
  const render = useRenderStatus()
  return (
    <div
      id="clone-status"
      className={`absolute left-0 top-[calc(100%_+_10px)] z-30 w-[268px] rounded-lg bg-term-bg px-4 py-2.5 font-mono text-xs leading-[1.95] text-term-dim shadow-[0_16px_40px_-12px_rgb(0_0_0/0.45)] print:hidden ${open ? 'block' : 'hidden group-hover/avatar:block'}`}
    >
      <p className="m-0 mb-1 text-term-accent">$ clone status</p>
      {[
        ['corpus', `${STARS.length} public sources`],
        ['lines', `${RESUME_LINE_COUNT} citable`],
        ['retrieval', 'bm25 + bge-m3, fused, reranked'],
        ['guard', 'checks answers as they stream'],
        ['render', render],
      ].map(([k, v]) => (
        <div key={k} className="grid grid-cols-[80px_1fr]">
          <span>{k}</span>
          <span className="font-medium text-term-text">{v}</span>
        </div>
      ))}
    </div>
  )
}

function PanelHeader({ state, onReset, onClose }: { state: CloneState; onReset?: () => void; onClose?: () => void }) {
  const [statusOpen, setStatusOpen] = useState(false)
  return (
    <header className="relative flex items-center gap-3 border-b border-rule px-[18px] py-3.5">
      {onClose && <span aria-hidden className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-rule lg:hidden" />}
      <div className="group/avatar relative shrink-0">
        {/* Thinking: a mint ring circles the avatar. With motion off, the status text beside the name stands in. */}
        <span
          aria-hidden
          className={`absolute -inset-[3px] rounded-full bg-[conic-gradient(transparent_25%,var(--color-term-accent)_75%)] still:hidden ${state === 'thinking' ? 'animate-spin' : 'hidden'}`}
        />
        <span aria-hidden data-pulse className="absolute -inset-[3px] rounded-full border-2 border-coral opacity-0" />
        <button
          type="button"
          aria-label="Clone status"
          aria-expanded={statusOpen}
          aria-controls="clone-status"
          onClick={() => setStatusOpen((o) => !o)}
          onFocus={(e) => e.currentTarget.matches(':focus-visible') && setStatusOpen(true)}
          onBlur={() => setStatusOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setStatusOpen(false)}
          className="relative block cursor-help rounded-full"
        >
          <Image data-nod src="/raj-avatar.webp" alt="" width={38} height={38} className="relative size-[38px] rounded-full ring-1 ring-white" />
        </button>
        <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-forest" />
        <CloneStatus open={statusOpen} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h2 className="type-display text-[20px] leading-none tracking-[0.02em]">Ask Raj</h2>
          {/* The live region announces the answer; this is for sighted visitors with motion off. */}
          {state !== 'idle' && (
            <span aria-hidden className="hidden font-mono text-xs leading-none text-muted still:inline">
              {state}…
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[12.5px] text-muted">AI clone · answers from my resume and my own words</p>
      </div>
      {onReset && (
        <button type="button" onClick={onReset} className="inline-flex h-9 items-center rounded-md px-2 text-[12.5px] font-medium text-muted hover:bg-paper hover:text-ink">
          New chat
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-ink"
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
      <p className="text-[15px] leading-relaxed">
        Hi — I’m an AI version of Raj. I answer from his resume and from interview questions he’s answered in his own words, and I cite
        where each answer comes from. <span className="text-muted">Cited resume lines light up <span className="lg:hidden">in the resume</span><span className="max-lg:hidden">on the left</span>.</span>
      </p>
      <p className="mb-2 mt-5 font-mono text-xs lowercase text-muted">Try asking</p>
      <ul className="grid gap-1.5">
        {STARTERS.map((q, i) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="grid min-h-11 w-full grid-cols-[28px_1fr] gap-1 rounded-[10px] border border-rule px-3 py-2.5 text-left text-sm transition-colors hover:border-forest hover:bg-paper"
            >
              <span aria-hidden className="font-mono text-[11px] leading-[1.9] text-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{q}</span>
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
    <div className="text-[15px] leading-relaxed">
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
      {m.status === 'streaming' && m.content && <span aria-hidden className="ml-0.5 inline-block h-[15px] w-[7px] animate-blink bg-forest align-[-2px] still:animate-none" />}
      {m.status === 'stopped' && <p className="mt-2 text-xs text-muted">Stopped.</p>}
      {m.meta?.guarded && (
        <p className="mt-2 text-xs text-muted">I stopped early rather than quote my private notes word for word. Ask me to put it differently.</p>
      )}

      {listed.length > 0 && m.status !== 'streaming' && (
        <div className="mt-2.5 rounded-xl border border-rule bg-paper p-2">
          <p className="mx-1 mb-1.5 font-mono text-[11px] lowercase text-muted">
            {cited.length && !showAll ? 'Sources cited' : 'Sources retrieved'}
          </p>
          <ul className="space-y-0.5">
            {listed.map((s) => (
              <li key={s.n}>
                <SourceRow source={s} active={activeN === s.n} onOpen={() => onCite(s.n)} />
              </li>
            ))}
          </ul>
          {cited.length > 0 && sources.length > cited.length && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="mx-1 mt-1.5 text-xs text-muted underline decoration-current/45 underline-offset-4 hover:text-ink">
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
        'flex w-full gap-2 rounded-lg p-1.5 text-left transition-colors',
        active ? 'bg-marker/70' : 'hover:bg-white',
      ].join(' ')}
    >
      <span className="mt-0.5 grid h-[19px] min-w-[19px] place-items-center rounded bg-coral/10 px-1 font-mono text-[11px] font-medium text-coral-ink">{s.n}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5 text-xs">
          <span className="truncate font-medium text-ink">{label}</span>
          <span className="shrink-0 text-muted">{isPublic ? (s.kind === 'profile' ? 'Profile' : 'Resume') : 'In my own words'}</span>
          {isPublic && s.anchor && <span className="ml-auto shrink-0 text-forest">Show ↗</span>}
        </span>
        <span className="mt-0.5 line-clamp-1 text-xs text-muted">{isPublic ? s.snippet : `“${s.title}”`}</span>
      </span>
    </button>
  )
}
