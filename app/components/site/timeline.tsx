'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView } from '@/app/lib/use-in-view'
import { citedIn, matchesIn } from './resume-helpers'
import { useSite, useSkillHover } from './site-context'
import { timelineBars, type TimelineBar } from './timeline-data'

// C7 Career timeline (REDESIGN-PLAN.md §2): a swimlane of study, work (two tracks), builds and
// community. Work and build bars are buttons that open their row or card; the hovered or filtered
// skill puts a tick on each matching line's bar, and bars cited in the latest answer get a ring.

const W = 1000
const H = 246
const X0 = 96
const X1 = 968
/** Share of the axis for the years before the first role, which are compressed. */
const SQ = 0.16
const BAR_H = 20
const LANE_Y = { study: 34, work: [84, 112], build: 160, community: 200 } as const

/** Mid-month, so server and client agree unless the month itself changed. */
function monthNow(d = new Date()): number {
  return d.getFullYear() + d.getMonth() / 12 + 0.5 / 12
}

/**
 * The latest date the resume names. It stands in for `now` in the server HTML and on the first
 * client render: `/` is prerendered, so the server's clock can be months old at hydration.
 */
const LATEST = (() => {
  const bars = timelineBars(0)
  return Math.max(...bars.map((b) => b.start), ...bars.filter((b) => !b.ongoing).map((b) => b.end))
})()

interface Axis {
  x: (t: number) => number
  years: number[]
  /** Where the compressed stretch ends (the first role's year). */
  brk: number
}

export function timelineAxis(bars: TimelineBar[], now: number): Axis {
  const t0 = Math.floor(Math.min(...bars.map((b) => b.start)))
  const brk = Math.max(t0 + 1, Math.floor(Math.min(...bars.filter((b) => b.lane === 'work').map((b) => b.start))))
  const t1 = now + 0.3
  const span = X1 - X0
  const at = (t: number) => (t <= brk ? X0 + ((t - t0) / (brk - t0)) * SQ * span : X0 + SQ * span + ((t - brk) / (t1 - brk)) * (1 - SQ) * span)
  const x = (t: number) => Math.round(at(t) * 100) / 100
  const years: number[] = []
  for (let y = t0; y < brk; y += 2) years.push(y)
  for (let y = brk; y <= Math.floor(now); y++) years.push(y)
  return { x, years, brk }
}

export function Timeline(): React.ReactNode {
  const { skill, cited, focusAnchor } = useSite()
  const [hover] = useSkillHover()
  const [now, setNow] = useState(LATEST)
  const [watch, inView] = useInView<HTMLDivElement>({ once: true })
  const scroller = useRef<HTMLDivElement>(null)
  const pin = useRef<SVGGElement>(null)

  useEffect(() => setNow(Math.max(LATEST, monthNow())), [])

  // Narrow screens scroll the chart sideways. It opens at the recent end and stays there when the
  // width changes (unless the reader scrolled back); the lane labels stay pinned on the left.
  useEffect(() => {
    const el = scroller.current
    const svg = el?.querySelector('svg')
    if (!el || !svg) return
    let atEnd = true
    let width = el.clientWidth
    const place = () => pin.current?.setAttribute('transform', `translate(${(el.scrollLeft * W) / svg.getBoundingClientRect().width},0)`)
    const toEnd = () => {
      el.scrollLeft = el.scrollWidth - el.clientWidth
      place()
    }
    const onScroll = () => {
      atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2
      place()
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      if (atEnd) toEnd()
      else place()
    })
    toEnd()
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  const bars = timelineBars(now)
  const { x, years, brk } = timelineAxis(bars, now)
  const lit = hover ?? skill
  const builds = bars.filter((b) => b.lane === 'build')

  const open = (anchor: string, fromKeyboard: boolean) => {
    focusAnchor(anchor, { block: 'start', flash: false })
    if (!fromKeyboard) return
    // Keyboard users land where the page went: the row's summary, or the card's first control.
    requestAnimationFrame(() => {
      const el = document.getElementById(anchor)
      const target = el instanceof HTMLDetailsElement ? el.querySelector('summary') : el?.querySelector<HTMLElement>('summary, a[href], button')
      target?.focus({ preventScroll: true })
    })
  }

  return (
    <div ref={watch} className="mt-10">
      {/* Touch swipes with no scrollbar; a mouse needs a thin one to reach the earlier years. */}
      <div ref={scroller} className="overflow-x-auto [scrollbar-width:none] pointer-fine:[scrollbar-width:thin]">
        {/* A labelled group, not role="img": an image's children are hidden, and the bars are buttons. */}
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Career timeline, study, work, builds and community, to now" className="block h-auto w-full min-w-[760px] font-mono">
          <defs>
            <linearGradient id="tl-soft" x1="0" x2="1">
              <stop offset="0" style={{ stopColor: 'var(--color-muted)', stopOpacity: 0 }} />
              <stop offset="0.22" style={{ stopColor: 'var(--color-muted)', stopOpacity: 0.45 }} />
              <stop offset="0.78" style={{ stopColor: 'var(--color-muted)', stopOpacity: 0.45 }} />
              <stop offset="1" style={{ stopColor: 'var(--color-muted)', stopOpacity: 0 }} />
            </linearGradient>
            <linearGradient id="tl-pin-fade" x1="0" x2="1">
              <stop offset="0" style={{ stopColor: 'var(--color-paper)' }} />
              <stop offset="1" style={{ stopColor: 'var(--color-paper)', stopOpacity: 0 }} />
            </linearGradient>
          </defs>

          <g aria-hidden>
            {years.map((y) => (
              <g key={y}>
                <line x1={x(y)} x2={x(y)} y1="14" y2="220" className="stroke-rule" />
                <text x={x(y) + 3} y="238" className="fill-muted text-[11px] @max-[760px]:text-[14px]">
                  {y}
                </text>
              </g>
            ))}
            <text x={x(brk - 0.5)} y="238" textAnchor="middle" className="fill-muted text-[11px] @max-[760px]:text-[14px]">
              ≈
            </text>
          </g>

          {bars.map((b) => {
            const a = b.anchor
            return (
              <Bar
                key={`${b.lane}-${a ?? b.label}`}
                bar={b}
                x={x}
                // The builds cluster within months, so one label names the group; each bar has its title.
                label={b.lane === 'build' ? (b === builds[0] ? `${builds.length} builds` : '') : b.label}
                ticks={a ? matchesIn(a, lit) : 0}
                dimmed={b.lane === 'work' && !!a && skill !== null && matchesIn(a, skill) === 0}
                cited={!!a && citedIn(cited, a) > 0}
                grow={inView}
                onOpen={a && (b.lane === 'work' || b.lane === 'build') ? (kb) => open(a, kb) : undefined}
              />
            )
          })}

          <g aria-hidden>
            <line x1={x(now)} x2={x(now)} y1="14" y2="222" className="stroke-muted [stroke-dasharray:2_3]" />
            <text x={x(now) - 4} y="10" textAnchor="end" className="fill-muted text-[11px] @max-[760px]:text-[14px]">
              now
            </text>
          </g>

          {/* Lane labels. On narrow screens a scroll handler keeps them pinned on the left. */}
          <g ref={pin} aria-hidden>
            <rect x="-2" y="0" width={X0 - 12} height={H} className="fill-paper" />
            <rect x={X0 - 14} y="0" width="12" height={H} fill="url(#tl-pin-fade)" />
            {(
              [
                ['study', LANE_Y.study + 13],
                ['work', LANE_Y.work[0] + 27],
                ['builds', LANE_Y.build + 13],
                ['community', LANE_Y.community + 13],
              ] as const
            ).map(([name, y]) => (
              <text key={name} x="0" y={y} className="fill-muted text-[12px] @max-[760px]:text-[14px]">
                {name}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        <span className="pointer-coarse:hidden">Year-only dates have soft ends. Click a bar to open that role or build.</span>
        <span className="hidden pointer-coarse:inline">Swipe back for earlier years. Tap a bar to open that role or build.</span>
      </p>
    </div>
  )
}

interface BarProps {
  bar: TimelineBar
  x: (t: number) => number
  label: string
  ticks: number
  dimmed: boolean
  cited: boolean
  grow: boolean
  /** Work and build bars open their row or card; the argument says whether a key did it. */
  onOpen?: (fromKeyboard: boolean) => void
}

function Bar({ bar: b, x, label, ticks, dimmed, cited, grow, onOpen }: BarProps): React.ReactNode {
  const y = b.lane === 'work' ? LANE_Y.work[b.track] : LANE_Y[b.lane]
  const x0 = x(b.start)
  const w = Math.max(6, x(b.end) - x0)

  const fill = {
    work: 'fill-forest group-hover/bar:fill-pine group-focus-visible/bar:fill-pine',
    study: '',
    build: 'fill-sun group-hover/bar:opacity-75',
    community: 'fill-none',
  }[b.lane]
  const stroke = cited ? 'stroke-coral [stroke-width:2.5]' : b.lane === 'community' ? 'stroke-forest [stroke-width:1.5] [stroke-dasharray:4_3]' : ''

  return (
    <g
      className={`group/bar outline-offset-4 transition-opacity duration-300 ${onOpen ? 'cursor-pointer' : ''} ${dimmed ? 'opacity-25' : ''}`}
      {...(onOpen
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Open ${b.title}`,
            onClick: () => onOpen(false),
            // Like a native button: Enter acts on key down, Space on key up, so no key up is left
            // to land on the summary that focus moves to.
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              if (e.key === 'Enter' && !e.repeat) onOpen(true)
            },
            onKeyUp: (e: React.KeyboardEvent) => e.key === ' ' && onOpen(true),
          }
        : { 'aria-hidden': true })}
    >
      {b.lane === 'build' && <title>{b.title}</title>}
      <rect
        x={x0}
        y={y}
        width={w}
        height={BAR_H}
        rx="3"
        fill={b.soft ? 'url(#tl-soft)' : undefined}
        className={`origin-left [transform-box:fill-box] ${fill} ${stroke} ${grow ? 'animate-grow-x still:animate-none' : ''}`}
      />
      {label && <BarLabel lane={b.lane} label={label} x0={x0} w={w} y={y} />}
      {Array.from({ length: ticks }, (_, i) => (
        <circle
          key={i}
          cx={x0 + 8 + i * 9}
          cy={y - 6}
          r="3.2"
          className="fill-sun stroke-ink transition-opacity duration-300 [stroke-width:0.75] starting:opacity-0"
        />
      ))}
    </g>
  )
}

/** Inside the bar when it fits; otherwise above it (right-aligned near the end of the axis). Builds label the group on the left. */
function BarLabel({ lane, label, x0, w, y }: { lane: TimelineBar['lane']; label: string; x0: number; w: number; y: number }): React.ReactNode {
  const outside = 'pointer-events-none fill-ink font-sans text-[11.5px] font-medium'
  const tw = label.length * 7
  if (lane === 'build')
    return (
      <text x={x0 - 6} y={y + 14} textAnchor="end" className={outside}>
        {label}
      </text>
    )
  if (tw + 12 < w)
    return (
      <text x={x0 + 7} y={y + 14} className={`pointer-events-none font-sans text-[12px] ${lane === 'work' ? 'fill-paper font-semibold' : 'fill-ink font-medium'}`}>
        {label}
      </text>
    )
  return x0 + tw > X1 ? (
    <text x={x0 + w} y={y - 5} textAnchor="end" className={outside}>
      {label}
    </text>
  ) : (
    <text x={x0} y={y - 5} className={outside}>
      {label}
    </text>
  )
}
