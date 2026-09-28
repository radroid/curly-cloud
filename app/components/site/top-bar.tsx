'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NAV_SECTIONS, useActiveSection } from '@/app/lib/use-active-section'

type Mode = 'website' | 'terminal'
type Tone = 'light' | 'dark'

/** Website | Terminal switch. Shared by the resume site and terminal mode. */
export function ModeSwitch({ active, tone = 'light' }: { active: Mode; tone?: Tone }) {
  const dark = tone === 'dark'
  const item = (mode: Mode, href: string, label: React.ReactNode) => {
    const on = mode === active
    return (
      <Link
        href={href}
        aria-current={on ? 'page' : undefined}
        className={[
          // The pseudo-element stretches the hit area to 44 px without changing the look.
          'relative inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5',
          on
            ? dark
              ? 'bg-term-accent text-pine'
              : 'bg-ink text-paper'
            : dark
              ? 'text-term-dim hover:text-term-text'
              : 'text-muted hover:text-ink',
        ].join(' ')}
      >
        {label}
      </Link>
    )
  }
  return (
    <nav
      aria-label="View mode"
      className={[
        'inline-flex items-center rounded-full border p-0.5 transition-colors',
        dark ? 'border-term-dim/40 bg-transparent' : 'border-rule bg-white',
      ].join(' ')}
    >
      {item('website', '/', 'Website')}
      {item(
        'terminal',
        '/terminal',
        <>
          <span aria-hidden className="font-mono text-xs">
            &gt;_
          </span>
          Terminal
        </>,
      )}
    </nav>
  )
}

/** Stage tone while the dark hero is under the bar, paper after it. */
function useOverStage(): boolean {
  const [stage, setStage] = useState(true)
  useEffect(() => {
    const hero = document.getElementById('home')
    if (!hero || typeof IntersectionObserver === 'undefined') {
      setStage(!!hero)
      return
    }
    const io = new IntersectionObserver(([e]) => setStage(e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(hero)
    return () => io.disconnect()
  }, [])
  return stage
}

/**
 * C1. Fixed over the hero: dark and translucent on the stage, paper once the hero has scrolled
 * under it. Only colours change, so nothing below it moves.
 */
export function TopBar() {
  const stage = useOverStage()
  const current = useActiveSection()
  return (
    <header
      data-tone={stage ? 'stage' : 'paper'}
      className={[
        'fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-5 border-b px-gutter backdrop-blur-[10px] transition-[background-color,color,border-color] duration-300 print:hidden',
        stage ? 'border-transparent bg-night-deep/55 text-term-text' : 'border-rule bg-paper/92 text-ink',
      ].join(' ')}
    >
      <a href="#home" className="type-display whitespace-nowrap text-[21px]">
        Raj Dholakia
      </a>
      <nav aria-label="Sections" className="ml-auto hidden gap-1 lg:flex">
        {NAV_SECTIONS.map((s, i) => {
          const on = s.id === current
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={on ? 'true' : undefined}
              className={[
                'inline-flex h-11 items-center rounded-md px-2 font-mono text-xs font-medium uppercase tracking-[0.06em] transition-colors',
                on ? '' : stage ? 'text-term-dim hover:text-term-text' : 'text-muted hover:text-ink',
              ].join(' ')}
            >
              <span className={`mr-1 ${on ? (stage ? 'text-sun' : 'text-forest') : ''}`}>[{i + 1}]</span>
              {s.label}
            </a>
          )
        })}
      </nav>
      <Link
        href="/mac"
        title="The 1984 Macintosh version of this site"
        className={`hidden h-11 items-center font-mono text-xs transition-colors lg:inline-flex ${stage ? 'text-term-dim hover:text-term-text' : 'text-muted hover:text-ink'}`}
      >
        mac ’84
      </Link>
      <div className="max-lg:ml-auto">
        <ModeSwitch active="website" tone={stage ? 'dark' : 'light'} />
      </div>
    </header>
  )
}
