'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CitationSource } from '@/lib/rag/types'
import { dimmedBy } from './resume-helpers'

/**
 * Page-wide state for the resume site: the skill filter, which resume lines the latest answer
 * cited, the mobile sheet, and a mailbox so any part of the page can hand a question to the
 * Ask panel. It also owns the citation jump (`focusAnchor`), `#r-…` deep links and print.
 */

export interface AskRequest {
  id: number
  question: string
  /** Send immediately, or just prefill the input and focus it. */
  send: boolean
}

export interface FocusOptions {
  /** Where the target lands in the viewport. Lines centre; role rows and cards use 'start'. */
  block?: ScrollLogicalPosition
  /** Ring the target briefly (default true). */
  flash?: boolean
}

interface SiteState {
  skill: string | null
  setSkill: (id: string | null) => void
  /** Resume anchor → citation numbers from the most recent answer. */
  cited: Record<string, number[]>
  setCitedFromAnswer: (sources: CitationSource[], cited: number[]) => void
  clearCited: () => void
  /**
   * Bring a resume anchor into view: open the disclosures around it, clear a filter that dims it,
   * close the mobile sheet, then scroll and flash. Every citation, stat and timeline link uses it.
   */
  focusAnchor: (anchor: string, opts?: FocusOptions) => void
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  request: AskRequest | null
  ask: (question: string, opts?: { send?: boolean }) => void
  focusAsk: () => void
}

const SiteContext = createContext<SiteState | null>(null)

/** Skill chip under the pointer or focus. Separate from SiteState so hovering doesn't re-render the Ask panel. */
const SkillHoverContext = createContext<[string | null, (id: string | null) => void]>([null, () => {}])

const DESKTOP = '(min-width: 1024px)'
/** The hero's question box; `/` and "Ask" buttons focus it while it's on screen. */
export const HERO_PROMPT_ID = 'hero-q'

function motionOff(): boolean {
  const d = document.documentElement.dataset.motion
  if (d === 'saver') return true
  if (d === 'high' || d === 'medium') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function onScreen(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
}

/**
 * Open every <details> around `el` (and `el` itself, and the disclosure named by its
 * `data-opens`) without animation, so a scroll that follows lands on the final layout.
 */
function reveal(el: HTMLElement): void {
  const closed: HTMLDetailsElement[] = []
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null) if (!d.open) closed.push(d)
  const linked = el.dataset.opens ? document.getElementById(el.dataset.opens) : null
  if (linked instanceof HTMLDetailsElement && !linked.open) closed.push(linked)
  if (!closed.length) return
  const root = document.documentElement
  root.dataset.jump = ''
  for (const d of closed) d.open = true
  root.getBoundingClientRect() // apply the open while transitions are off
  requestAnimationFrame(() => delete root.dataset.jump)
}

const flashTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()

/** Ring an element for 2.4 s (styled by [data-flash] in global.css; static when motion is off). */
function flashEl(el: HTMLElement): void {
  clearTimeout(flashTimers.get(el))
  el.removeAttribute('data-flash')
  void el.offsetWidth // restart the animation if it was already running
  el.setAttribute('data-flash', '')
  flashTimers.set(
    el,
    setTimeout(() => el.removeAttribute('data-flash'), 2400),
  )
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [skill, setSkill] = useState<string | null>(null)
  const [hoverSkill, setHoverSkill] = useState<string | null>(null)
  const [cited, setCited] = useState<Record<string, number[]>>({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [request, setRequest] = useState<AskRequest | null>(null)
  const nextId = useRef(1)
  // Read inside focusAnchor without re-creating it (and every consumer) on each change.
  const live = useRef({ skill, sheetOpen })
  live.current = { skill, sheetOpen }

  const setCitedFromAnswer = useCallback((sources: CitationSource[], citedNums: number[]) => {
    const map: Record<string, number[]> = {}
    for (const n of citedNums) {
      const s = sources.find((x) => x.n === n)
      if (!s?.anchor || s.visibility !== 'public') continue
      ;(map[s.anchor] ??= []).push(n)
    }
    setCited(map)
  }, [])

  const clearCited = useCallback(() => setCited({}), [])

  const focusAnchor = useCallback((anchor: string, opts: FocusOptions = {}) => {
    const go = () => {
      const el = document.getElementById(anchor)
      if (!el) return
      if (dimmedBy(live.current.skill, anchor)) setSkill(null)
      reveal(el)
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: opts.block ?? 'center' })
        if (opts.flash !== false) flashEl(el)
      })
    }
    // On mobile the answer lives in a sheet over the resume: close it first so the line is visible.
    if (live.current.sheetOpen && !window.matchMedia(DESKTOP).matches) {
      setSheetOpen(false)
      setTimeout(go, 280)
    } else {
      go()
    }
  }, [])

  const ask = useCallback((question: string, opts: { send?: boolean } = {}) => {
    setRequest({ id: nextId.current++, question, send: opts.send ?? true })
    if (!window.matchMedia(DESKTOP).matches) setSheetOpen(true)
  }, [])

  const focusAsk = useCallback(() => {
    // While the hero is on screen its prompt is the nearest question box; the panel sits below it.
    const hero = document.getElementById(HERO_PROMPT_ID)
    if (hero && onScreen(hero)) {
      hero.focus()
      return
    }
    setRequest({ id: nextId.current++, question: '', send: false })
    if (!window.matchMedia(DESKTOP).matches) setSheetOpen(true)
  }, [])

  // Deep links: /#r-exp-eddy-mcp on load, or a later hash change, jumps to that line.
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (id.startsWith('r-')) focusAnchor(id)
    }
    const t = setTimeout(fromHash, 0)
    window.addEventListener('hashchange', fromHash)
    return () => {
      clearTimeout(t)
      window.removeEventListener('hashchange', fromHash)
    }
  }, [focusAnchor])

  // Save as PDF prints the whole resume: open every disclosure, then put them back.
  useEffect(() => {
    let closed: HTMLDetailsElement[] = []
    const before = () => {
      closed = [...document.querySelectorAll('details')].filter((d) => !d.open)
      document.documentElement.dataset.jump = ''
      for (const d of closed) d.open = true
    }
    const after = () => {
      for (const d of closed) d.open = false
      closed = []
      delete document.documentElement.dataset.jump
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  const value = useMemo<SiteState>(
    () => ({ skill, setSkill, cited, setCitedFromAnswer, clearCited, focusAnchor, sheetOpen, setSheetOpen, request, ask, focusAsk }),
    [skill, cited, setCitedFromAnswer, clearCited, focusAnchor, sheetOpen, request, ask, focusAsk],
  )
  const hover = useMemo<[string | null, (id: string | null) => void]>(() => [hoverSkill, setHoverSkill], [hoverSkill])
  return (
    <SiteContext.Provider value={value}>
      <SkillHoverContext.Provider value={hover}>{children}</SkillHoverContext.Provider>
    </SiteContext.Provider>
  )
}

export function useSite(): SiteState {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}

/** The skill chip being hovered or focused (lights up lines without filtering), and its setter. */
export function useSkillHover(): [string | null, (id: string | null) => void] {
  return useContext(SkillHoverContext)
}
