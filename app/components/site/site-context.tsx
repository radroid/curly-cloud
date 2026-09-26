'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { CitationSource } from '@/lib/rag/types'

/**
 * Page-wide state for the resume site: the skill filter, which resume lines the latest answer
 * cited, the mobile sheet, and a mailbox so any part of the page can hand a question to the
 * Ask panel.
 */

export interface AskRequest {
  id: number
  question: string
  /** Send immediately, or just prefill the input and focus it. */
  send: boolean
}

interface SiteState {
  skill: string | null
  setSkill: (id: string | null) => void
  /** Resume anchor → citation numbers from the most recent answer. */
  cited: Record<string, number[]>
  setCitedFromAnswer: (sources: CitationSource[], cited: number[]) => void
  clearCited: () => void
  /** Anchor briefly flashed after a citation click. */
  flash: string | null
  focusAnchor: (anchor: string) => void
  sheetOpen: boolean
  setSheetOpen: (open: boolean) => void
  request: AskRequest | null
  ask: (question: string, opts?: { send?: boolean }) => void
  focusAsk: () => void
}

const SiteContext = createContext<SiteState | null>(null)

const DESKTOP = '(min-width: 1024px)'

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [skill, setSkill] = useState<string | null>(null)
  const [cited, setCited] = useState<Record<string, number[]>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [request, setRequest] = useState<AskRequest | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(1)

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

  const focusAnchor = useCallback((anchor: string) => {
    const go = () => {
      const el = document.getElementById(anchor)
      if (!el) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
      setFlash(anchor)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      flashTimer.current = setTimeout(() => setFlash(null), 2400)
    }
    // On mobile the answer lives in a sheet over the resume: close it first so the line is visible.
    if (!window.matchMedia(DESKTOP).matches) {
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
    setRequest({ id: nextId.current++, question: '', send: false })
    if (!window.matchMedia(DESKTOP).matches) setSheetOpen(true)
  }, [])

  const value = useMemo<SiteState>(
    () => ({ skill, setSkill, cited, setCitedFromAnswer, clearCited, flash, focusAnchor, sheetOpen, setSheetOpen, request, ask, focusAsk }),
    [skill, cited, setCitedFromAnswer, clearCited, flash, focusAnchor, sheetOpen, request, ask, focusAsk],
  )
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite(): SiteState {
  const ctx = useContext(SiteContext)
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>')
  return ctx
}
