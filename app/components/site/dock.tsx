'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { RESUME } from '@/content/resume'
import { NAV_SECTIONS, useActiveSection } from '@/app/lib/use-active-section'
import { useLocalTime } from '@/app/lib/use-local-time'
import { useSite } from './site-context'

/**
 * C18 Mobile dock: the current section, which opens the menu, and Ask Raj, which opens the sheet.
 * It slides away while either is open.
 */
export function Dock() {
  const { sheetOpen, setSheetOpen } = useSite()
  const [menuOpen, setMenuOpen] = useState(false)
  const current = useActiveSection()
  const time = useLocalTime()
  const menuButton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const index = Math.max(0, NAV_SECTIONS.findIndex((s) => s.id === current))
  const hidden = sheetOpen || menuOpen

  // The dock is inert while the menu is open, so focus goes back once it has re-rendered.
  const refocus = useRef(false)
  const close = (returnFocus: boolean) => {
    refocus.current = returnFocus
    setMenuOpen(false)
  }
  useEffect(() => {
    if (menuOpen || !refocus.current) return
    refocus.current = false
    menuButton.current?.focus({ preventScroll: true })
  }, [menuOpen])

  // Open: focus the first item. Escape closes and returns focus; Tab stays inside the menu.
  useEffect(() => {
    if (!menuOpen) return
    const el = menu.current
    el?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        refocus.current = true
        setMenuOpen(false)
        return
      }
      if (e.key !== 'Tab' || !el) return
      const items = [...el.querySelectorAll<HTMLElement>('a, button')]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // A wider window has the top bar instead.
  useEffect(() => {
    if (!menuOpen) return
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = () => mql.matches && setMenuOpen(false)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [menuOpen])

  return (
    <div className="lg:hidden print:hidden">
      <div
        role="group"
        aria-label="Quick actions"
        inert={hidden}
        className={`fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 flex gap-2 transition-transform duration-300 ${hidden ? 'translate-y-[calc(100%+24px+env(safe-area-inset-bottom))]' : ''}`}
      >
        <button
          ref={menuButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="dock-menu"
          onClick={() => setMenuOpen(true)}
          className="flex h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-term-text/18 bg-night-deep/92 px-3.5 font-mono text-[12.5px] font-medium uppercase tracking-[0.06em] text-term-text backdrop-blur-[10px]"
        >
          <span aria-hidden className="text-sun">
            [{index + 1}]
          </span>
          <span className="truncate">
            {NAV_SECTIONS[index].label}
            <span className="sr-only">, open the menu</span>
          </span>
          <svg aria-hidden viewBox="0 0 16 16" className="ml-auto size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 4.5h10M3 8h10M3 11.5h10" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-[52px] shrink-0 items-center gap-2.5 rounded-2xl border border-term-accent bg-term-accent pl-1.5 pr-3.5 text-[15px] font-semibold text-pine"
        >
          {/* The clone at work while the sheet is closed (<html data-clone>, set by the Ask panel): a ring
              while it thinks, a nod as it answers. With motion off the ring holds still for both. */}
          <span className="relative shrink-0">
            <span
              aria-hidden
              className="absolute -inset-[3px] hidden overflow-hidden rounded-[15px] in-data-[clone=thinking]:block still:in-data-[clone=answering]:block"
            >
              <span className="absolute -inset-1/2 animate-spin bg-[conic-gradient(transparent_25%,var(--color-pine)_75%)] still:animate-none still:bg-pine" />
            </span>
            <span aria-hidden data-pulse className="absolute -inset-[3px] rounded-[15px] border-2 border-coral opacity-0" />
            <Image data-nod src="/raj-avatar.webp" alt="" width={38} height={38} className="relative size-[38px] rounded-xl ring-1 ring-term-accent" />
          </span>
          Ask Raj
        </button>
      </div>

      <div
        aria-hidden
        onClick={() => close(true)}
        className={`fixed inset-0 z-[55] bg-night-deep/45 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        ref={menu}
        id="dock-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!menuOpen}
        className={[
          'fixed inset-x-0 bottom-0 z-[70] rounded-t-[20px] bg-night-deep px-[22px] pb-[calc(28px+env(safe-area-inset-bottom))] pt-[22px] text-term-text duration-300',
          // Visible at once on open (so focus can land), hidden only after the slide on close.
          menuOpen ? 'visible translate-y-0 transition-[translate]' : 'invisible translate-y-[105%] transition-[translate,visibility]',
        ].join(' ')}
      >
        <nav aria-label="Sections">
          {NAV_SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={s.id === current ? 'true' : undefined}
              onClick={() => close(false)}
              className="flex items-baseline gap-3 border-b border-term-text/10 py-3"
            >
              <span aria-hidden className="font-mono text-xs text-sun">
                [{i + 1}]
              </span>
              <span className={`type-display text-[34px] ${s.id === current ? 'text-term-accent' : ''}`}>{s.label}</span>
            </a>
          ))}
        </nav>
        <div className="mt-[18px] grid justify-items-start font-mono text-[13px] text-term-dim">
          <a href={`mailto:${RESUME.email}`} className="inline-flex min-h-11 items-center underline decoration-current/45 underline-offset-4">
            {RESUME.email}
          </a>
          <span className="inline-flex min-h-11 items-center">
            Toronto&nbsp;<span className="inline-block min-w-[10ch] tabular-nums">{time ?? '--:--'}</span>
          </span>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center underline decoration-current/45 underline-offset-4">
            Save as PDF
          </button>
        </div>
      </div>
    </div>
  )
}
