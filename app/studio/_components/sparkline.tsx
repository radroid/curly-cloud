'use client'

import { useState } from 'react'
import { fmtCompact, fmtNum } from '@/lib/studio/shared'
import type { UsageDay } from '@/lib/studio/types'

const W = 320
const H = 72
const PAD = 5

function label(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Requests per day as a single 2px line with a soft area, a hover readout and a table for screen readers. */
export function Sparkline({ days }: { days: UsageDay[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (days.length < 2) return null
  const values = days.map((d) => d.requests)
  const max = Math.max(1, ...values)
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (days.length - 1)
  const y = (v: number) => H - PAD - (v / max) * (H - 2 * PAD)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(days.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`
  const active = hover ?? days.length - 1
  const d = days[active]
  const slot = (W - 2 * PAD) / (days.length - 1)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] text-muted">
          <span className="text-ink">{label(d.day)}</span>
          {hover == null ? ' · today' : ''}
        </p>
        <p className="font-mono text-[11px] tabular-nums text-muted">
          <span className="text-ink">{fmtNum(d.requests)}</span> req · {fmtCompact(d.tokensIn + d.tokensOut)} tok
        </p>
      </div>
      <div className="relative mt-2" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[72px] w-full" aria-hidden>
          <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-rule" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path d={area} className="fill-forest/10" />
          <path d={line} className="fill-none stroke-forest" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover != null ? (
            <line x1={x(active)} x2={x(active)} y1={0} y2={H - PAD} className="stroke-muted/50" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          ) : null}
          {days.map((_, i) => (
            <rect
              key={i}
              x={x(i) - slot / 2}
              y={0}
              width={slot}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          ))}
        </svg>
        <span
          aria-hidden
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-forest"
          style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(values[active]) / H) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-muted">
        <span>{label(days[0].day)}</span>
        <span>peak {fmtNum(max === 1 && values.every((v) => v === 0) ? 0 : max)}</span>
        <span>{label(days[days.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>Requests and tokens per day, last {days.length} days</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Requests</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {days.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td>
              <td>{row.requests}</td>
              <td>{row.tokensIn + row.tokensOut}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
