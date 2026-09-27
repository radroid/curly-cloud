'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { resumeSources } from '@/content/resume'
import { MOTION_TIERS, markBooted, type MotionTier } from '@/app/lib/motion'
import { useMotionTier } from '@/app/lib/use-motion-tier'
import { RESUME_LINE_COUNT } from './resume-helpers'

/**
 * C0 Boot overlay. It's in the server HTML but only shows under html[data-boot=play], which the
 * head script sets on the first visit of a session (app/lib/motion.ts), so skipped visits never
 * see it. If the app never hydrates, the CSS fallback wipes it away at 2.5 s.
 *
 * The % follows real milestones (fonts, then the hero's cloud chunk loaded and sampled), ramps
 * over 1.1 s and is capped at 1.4 s, then the overlay wipes up and calls markBooted(). Touching a
 * render-quality chip holds it until Enter.
 */

const SOURCE_COUNT = resumeSources().length
const RAMP_MS = 1100
const CAP_MS = 1400
const WIPE_MS = 700
/** The CSS fallback starts wiping at 2.5 s; if hydration comes later, let it finish. */
const FALLBACK_MS = 2400

/** Progress events from the hero's cloud renderer, on `window`. */
interface CloudEventDetail {
  stage: 'loaded' | 'sampled' | 'ready'
  /** Point count, when the renderer reports it. */
  points?: number
}

type Phase = 'ssr' | 'run' | 'wait' | 'out' | 'gone'

// The checked chip is styled from html[data-motion], so it's right before hydration too.
const CHECKED: Record<MotionTier, string> = {
  high: 'in-data-[motion=high]:border-term-text in-data-[motion=high]:bg-term-text in-data-[motion=high]:text-pine',
  medium: 'in-data-[motion=medium]:border-term-text in-data-[motion=medium]:bg-term-text in-data-[motion=medium]:text-pine',
  saver: 'in-data-[motion=saver]:border-term-text in-data-[motion=saver]:bg-term-text in-data-[motion=saver]:text-pine',
}

export function Boot(): React.ReactNode {
  const [phase, setPhase] = useState<Phase>('ssr')
  const [pct, setPct] = useState(0)
  const [log, setLog] = useState<[string, string][]>([])
  const { tier, setTier } = useMotionTier()
  const tierRef = useRef(tier)
  tierRef.current = tier
  const chips = useRef<(HTMLButtonElement | null)[]>([])
  const booting = phase === 'run' || phase === 'wait'

  const note = useCallback((key: string, value: string) => {
    setLog((l) => (l.some(([k]) => k === key) ? l.map((e) => (e[0] === key ? [key, value] : e)) : [...l, [key, value]]))
  }, [])

  const exit = useCallback(() => setPhase((p) => (p === 'run' || p === 'wait' ? 'out' : p)), [])

  // Take over from the CSS fallback, or step aside if this visit skips the intro.
  useEffect(() => {
    if (document.documentElement.dataset.boot !== 'play') return setPhase('gone')
    if (performance.now() > FALLBACK_MS) {
      markBooted()
      return setPhase('gone')
    }
    setPhase('run')
  }, [])

  // Progress: a ramp held back until the milestones arrive, forced to 100 at the cap. Timed from
  // navigation start, since the overlay has been on screen since first paint.
  useEffect(() => {
    if (!booting) return
    const done = { fonts: false, loaded: false, sampled: false }
    let alive = true
    let raf = 0
    let shown = 0

    document.fonts?.ready.then(() => {
      if (!alive) return
      done.fonts = true
      note('fonts', 'ready')
    })
    const onCloud = (e: Event) => {
      const d = (e as CustomEvent<CloudEventDetail>).detail
      if (d?.stage === 'loaded') done.loaded = true
      if (d?.stage === 'sampled' || d?.stage === 'ready') {
        done.loaded = done.sampled = true
        note('points', typeof d.points === 'number' ? d.points.toLocaleString('en-CA') : 'sampled')
      }
    }
    window.addEventListener('curlycloud:cloud', onCloud)

    const step = () => {
      const t = performance.now()
      const milestones = Number(done.fonts) + Number(done.loaded) + Number(done.sampled)
      const held = Math.min((t / RAMP_MS) * 100, 64 + 12 * milestones, 100)
      // Over the last 200 ms before the cap, run out whatever is left rather than jump.
      const finish = Math.min(1, Math.max(0, (t - (CAP_MS - 200)) / 200))
      const n = Math.max(shown, Math.floor(held + (100 - held) * finish))
      if (n > 20 && shown <= 20) note('corpus', `${SOURCE_COUNT} public sources, ${RESUME_LINE_COUNT} lines`)
      if (n !== shown) {
        shown = n
        setPct(n)
      }
      if (n < 100) raf = requestAnimationFrame(step)
      else note('render', tierRef.current)
    }
    raf = requestAnimationFrame(step)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('curlycloud:cloud', onCloud)
    }
  }, [booting, note])

  // Auto-enter a beat after 100 % (a paused intro is in 'wait' and waits for Enter).
  useEffect(() => {
    if (phase !== 'run' || pct < 100) return
    const t = setTimeout(exit, 280)
    return () => clearTimeout(t)
  }, [phase, pct, exit])

  // While paused, the page underneath is inert.
  useEffect(() => {
    const main = phase === 'wait' ? document.getElementById('main') : null
    if (!main) return
    main.inert = true
    return () => {
      main.inert = false
    }
  }, [phase])

  // Escape leaves from anywhere; Enter leaves when nothing else has focus.
  useEffect(() => {
    if (!booting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && document.activeElement === document.body)) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [booting, exit])

  // The wipe, then remember that the intro has played.
  useEffect(() => {
    if (phase !== 'out') return
    const t = setTimeout(() => {
      markBooted()
      setPhase('gone')
    }, WIPE_MS + 20)
    return () => clearTimeout(t)
  }, [phase])

  const pick = (t: MotionTier) => {
    setTier(t)
    note('render', t)
    setPhase((p) => (p === 'run' ? 'wait' : p))
  }

  // Radio group keys: arrows move the choice and the focus.
  const onChipKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = (i + d + MOTION_TIERS.length) % MOTION_TIERS.length
    pick(MOTION_TIERS[j].id)
    chips.current[j]?.focus()
  }

  if (phase === 'gone') return null

  return (
    <section
      aria-label="Intro"
      className={[
        'fixed inset-0 z-[100] hidden grid-rows-[1fr_auto] bg-night-deep p-[clamp(20px,4vw,48px)] pb-[calc(clamp(20px,4vw,48px)+env(safe-area-inset-bottom))] text-term-text in-data-[boot=play]:grid print:hidden',
        'transition-[clip-path] duration-700 ease-[cubic-bezier(0.7,0,0.2,1)]',
        phase === 'out' ? '[clip-path:inset(0_0_100%_0)]' : '[clip-path:inset(0)]',
        phase === 'ssr' ? 'animate-boot-fallback' : '',
      ].join(' ')}
    >
      <p aria-hidden className="type-display m-0 self-start justify-self-end text-[clamp(96px,20vw,260px)] tabular-nums">
        {pct}
        <span className="ml-[0.04em] align-[0.9em] text-[0.4em]">%</span>
      </p>
      <div className="grid items-end gap-6 sm:grid-cols-[1fr_auto]">
        <div aria-hidden className="min-h-[11.4em] font-mono text-[13px] leading-[1.9] text-term-dim">
          <p className="m-0">$ clone boot</p>
          {log.map(([k, v]) => (
            <p key={k} className="m-0">
              <b className="font-medium text-term-text">{k}</b>&nbsp;&nbsp;{v}
            </p>
          ))}
          {pct >= 100 && <p className="m-0 text-term-accent">ready</p>}
        </div>
        <div className="grid justify-items-start gap-3.5 sm:justify-items-end">
          <span id="boot-tier-label" className="font-mono text-xs text-term-dim">
            render quality
          </span>
          <div role="radiogroup" aria-labelledby="boot-tier-label" className="flex gap-1.5">
            {MOTION_TIERS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  chips.current[i] = el
                }}
                type="button"
                role="radio"
                aria-checked={phase !== 'ssr' && tier === t.id}
                tabIndex={phase === 'ssr' || tier === t.id ? 0 : -1}
                onClick={() => pick(t.id)}
                onKeyDown={(e) => onChipKey(e, i)}
                className={`h-11 rounded-full border border-term-text/30 px-3.5 text-[13px] font-medium text-term-dim transition-colors hover:text-term-text ${CHECKED[t.id]}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exit}
            className={`h-[52px] rounded-xl bg-term-accent px-[34px] text-base font-semibold text-pine transition-shadow ${phase === 'wait' ? 'ring-6 ring-term-accent/18' : ''}`}
          >
            Enter
          </button>
        </div>
      </div>
    </section>
  )
}
