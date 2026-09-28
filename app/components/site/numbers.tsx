'use client'

import { useEffect, useRef, useState } from 'react'
import { RESUME } from '@/content/resume'
import { useMotionTier } from '@/app/lib/use-motion-tier'
import { useSite } from './site-context'
import { formatStat, STATS, type Stat } from './stats'

// C5 Numbers: the six STATS as instruments. The final values are in the server HTML; once an
// instrument is in view the number counts to its value and the unit marks fill (M7).

/**
 * What the unit charts draw beyond the stat's own value. Each figure is quoted from the stat's
 * source line (numbers.test.ts), so a chart can't say more than the resume does.
 */
export const CHART = {
  devicesPerDot: 1000,
  postingsPerMark: 1000,
  /** Postings: the three named vectors every posting has. */
  vectors: ['explicit', 'inferred', 'company'],
  /** Regulatory documents: the split behind "40+". */
  priorityDocs: 15,
  bestPracticeDocs: 26,
  /** Processes: "cutting manual work by about 60%". */
  manualWorkCut: 0.6,
}

const firstRole = RESUME.experience.reduce((a, b) => (b.start < a.start ? b : a))

/** One segment per year shipped, starting with the first role's year. */
export function yearSegments(years: number): number[] {
  const start = Number(firstRole.start.slice(0, 4))
  return Array.from({ length: years }, (_, i) => start + i)
}

/** The value a counter shows at eased progress `p` (0 → start, 1 → final). */
export function countAt(stat: Stat, p: number): number {
  const from = stat.from ?? 0
  return Math.round(from + (stat.value - from) * p)
}

/** What a screen reader hears for the value: "150,000+", "15 to 2 min". */
export function spokenValue(stat: Stat): string {
  const to = `${formatStat(stat.value)}${stat.suffix}`
  return stat.from === undefined ? to : `${formatStat(stat.from)} to ${to}`
}

const DURATION = 1300
const START_AT = 0.35

export function Numbers(): React.ReactNode {
  return (
    <section aria-labelledby="numbers-title" className="pt-14 sm:pt-24">
      <h2 id="numbers-title" className="sr-only">
        Numbers from the resume
      </h2>
      <ul role="list" className="grid grid-cols-3 gap-x-11 @max-[860px]:grid-cols-2 @max-[560px]:gap-x-5">
        {STATS.map((s) => (
          <Instrument key={s.id} stat={s} />
        ))}
      </ul>
    </section>
  )
}

function Instrument({ stat }: { stat: Stat }): React.ReactNode {
  const { focusAnchor } = useSite()
  const { tier } = useMotionTier()
  // Eased progress of the count. 1 is the final state: server HTML, Saver, reduced motion, done.
  const [p, setP] = useState(1)
  const ref = useRef<HTMLLIElement>(null)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || done.current || tier === 'saver' || typeof IntersectionObserver === 'undefined') return
    let raf = 0
    let first = true
    const finish = () => {
      done.current = true
      io.disconnect()
      cancelAnimationFrame(raf)
      setP(1)
    }
    const run = () => {
      done.current = true
      io.disconnect()
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / DURATION)
        setP(1 - (1 - k) ** 3)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      setP(0)
      raf = requestAnimationFrame(step)
    }
    // Zero the counter as the instrument's top edge enters, count once enough of it shows, and put
    // the final value back if it leaves before that. On screen already at load: count right away.
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1]
        if (first ? e.isIntersecting : e.intersectionRatio >= START_AT) run()
        else setP(e.isIntersecting ? 0 : 1)
        first = false
      },
      { threshold: [0, START_AT] },
    )
    io.observe(el)
    window.addEventListener('beforeprint', finish)
    return () => {
      window.removeEventListener('beforeprint', finish)
      if (done.current) finish()
      else {
        io.disconnect()
        setP(1)
      }
    }
  }, [tier])

  const counting = p < 1
  const suffix = stat.suffix.trim()
  return (
    <li ref={ref} className="grid min-w-0 grid-rows-[auto_auto_1fr_auto] border-t border-rule pb-[30px] pt-5 @max-[560px]:pb-[22px] @max-[560px]:pt-3.5">
      <p className="type-display whitespace-nowrap text-[clamp(54px,7.2cqi,92px)] tabular-nums @max-[560px]:text-[46px]">
        <span className="sr-only normal-case">{spokenValue(stat)}</span>
        {/* Anton has no tabular figures, so the final number holds the width and the count sits
            over it in a fixed box, anchored right: nothing around it moves while it counts. */}
        <span aria-hidden className="relative inline-block">
          <span className={counting ? 'invisible' : undefined}>{formatStat(stat.value)}</span>
          {counting && <span className="absolute inset-0 [direction:rtl]">{formatStat(countAt(stat, p))}</span>}
        </span>
        {suffix && (
          <small aria-hidden className={suffix === '+' ? 'ml-[0.02em] align-[0.42em] text-[0.62em]' : 'ml-[0.08em] text-[0.42em]'}>
            {suffix}
          </small>
        )}
      </p>
      <p className="mb-3.5 mt-2.5 max-w-[30ch] text-[15px] leading-normal @max-[560px]:mb-2.5 @max-[560px]:mt-2 @max-[560px]:text-[13.5px]">{stat.label}</p>
      <div aria-hidden className="font-mono text-[11px] leading-snug text-muted @max-[560px]:text-[10px]">
        <Chart stat={stat} p={p} />
      </div>
      <button
        type="button"
        onClick={() => focusAnchor(stat.anchor)}
        className="mt-1 inline-flex min-h-11 items-center justify-self-start text-left font-mono text-xs text-muted underline decoration-current/45 underline-offset-4 hover:decoration-current @max-[560px]:text-[11px]"
      >
        source: {stat.source}
      </button>
    </li>
  )
}

const W = 300

/** Unit mark `i` of `n` stays faint until the count reaches it. */
function faint(i: number, n: number, p: number): boolean {
  return p < 1 && i >= Math.floor(p * n)
}

function unit(fill: string, i: number, n: number, p: number): string {
  return faint(i, n, p) ? `${fill} opacity-14` : fill
}

/** The unit chart for one stat (the prototype's `vizSvg`). Captions are HTML so they stay legible. */
function Chart({ stat, p }: { stat: Stat; p: number }): React.ReactNode {
  switch (stat.viz) {
    case 'years': {
      const years = yearSegments(stat.value)
      const w = W / years.length
      return (
        <>
          <svg viewBox={`0 0 ${W} 12`} className="block h-auto w-full">
            {years.map((y, i) => (
              <rect key={y} x={i * w} width={w - 4} height={12} rx={2} className={unit('fill-forest', i, years.length, p)} />
            ))}
          </svg>
          <p className="mt-1.5 flex">
            {years.map((y) => (
              <span key={y} className="flex-1">
                {y}
              </span>
            ))}
          </p>
        </>
      )
    }
    case 'devices': {
      const n = stat.value / CHART.devicesPerDot
      const cols = 30
      return (
        <>
          <svg viewBox={`0 0 ${W} ${Math.ceil(n / cols) * 9 - 1}`} className="block h-auto w-full">
            {Array.from({ length: n }, (_, i) => (
              <circle key={i} cx={(i % cols) * 10 + 4} cy={Math.floor(i / cols) * 9 + 4} r={3} className={unit('fill-forest', i, n, p)} />
            ))}
          </svg>
          <p className="mt-1">each dot = {formatStat(CHART.devicesPerDot)} devices</p>
        </>
      )
    }
    case 'processes': {
      const n = stat.value
      return (
        <svg viewBox={`0 0 ${W} 32`} className="block h-auto w-full">
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={(i * W) / n} width={2} height={18} className={unit('fill-forest', i, n, p)} />
          ))}
          <rect y={26} width={W} height={6} rx={3} className="fill-rule/60" />
          <rect y={26} width={W * CHART.manualWorkCut * p} height={6} rx={3} className="fill-sun" />
        </svg>
      )
    }
    case 'deploy': {
      const from = stat.from ?? stat.value
      // The bar shrinks from the old deploy time to the new one.
      const width = W - (W - (W * stat.value) / from) * p
      return (
        <>
          <svg viewBox={`0 0 ${W} 12`} className="block h-auto w-full">
            <rect width={W} height={12} rx={3} className="fill-rule/60" />
            <rect width={width} height={12} rx={3} className="fill-forest" />
          </svg>
          <p className="mt-1.5 flex justify-between gap-3">
            <span className="text-ink">
              {formatStat(stat.value)}
              {stat.suffix} after
            </span>
            <span>
              {formatStat(from)}
              {stat.suffix} before
            </span>
          </p>
        </>
      )
    }
    case 'postings': {
      // The value is in thousands (100K). Every mark carries all three vectors, one band each.
      const n = (stat.value * 1000) / CHART.postingsPerMark
      const cols = 50
      const band = 7 / CHART.vectors.length
      const fills = ['fill-forest', 'fill-sun', 'fill-muted']
      return (
        <>
          <svg viewBox={`0 0 ${W} ${Math.ceil(n / cols) * 9 - 2}`} className="block h-auto w-full">
            {Array.from({ length: n }, (_, i) => (
              <g key={i} className={faint(i, n, p) ? 'opacity-14' : undefined}>
                {CHART.vectors.map((v, j) => (
                  <rect key={v} x={(i % cols) * 6} y={Math.floor(i / cols) * 9 + j * band} width={4.5} height={band} className={fills[j]} />
                ))}
              </g>
            ))}
          </svg>
          <p className="mt-1">
            each mark = {formatStat(CHART.postingsPerMark)} postings · {CHART.vectors.join(', ')}
          </p>
        </>
      )
    }
    case 'docs': {
      const n = CHART.priorityDocs + CHART.bestPracticeDocs
      const cols = 21
      return (
        <>
          <svg viewBox={`0 0 ${W} ${Math.ceil(n / cols) * 16 - 3}`} className="block h-auto w-full">
            {Array.from({ length: n }, (_, i) => (
              <rect
                key={i}
                x={(i % cols) * 14.2}
                y={Math.floor(i / cols) * 16}
                width={11}
                height={13}
                rx={1.5}
                className={unit(i < CHART.priorityDocs ? 'fill-sun' : 'fill-forest', i, n, p)}
              />
            ))}
          </svg>
          <p className="mt-1">
            {CHART.priorityDocs} priority REGDOCs + {CHART.bestPracticeDocs} best-practice
          </p>
        </>
      )
    }
  }
}
