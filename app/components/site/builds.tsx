'use client'

import { RESUME, resumeAnchor } from '@/content/resume'
import { Lines } from './resume'

// C9 Independent builds. P5 replaces this with the featured and compact build cards, the eval
// chart and the search pipeline (REDESIGN-PLAN.md §2). Anchors stay on the same elements.

export function Builds() {
  return (
    <div>
      <h3 className="type-display mb-4 mt-14 text-[32px]">Independent builds</h3>
      <div className="space-y-5">
        {RESUME.builds.map((b) => {
          const anchor = resumeAnchor('build', b.id)
          return (
            <article key={b.id} id={anchor} className="scroll-mt-32 rounded-2xl border border-rule bg-white p-5 sm:p-6">
              <p className="font-mono text-xs text-muted">{b.period}</p>
              <h4 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{b.title}</h4>
              {b.link && (
                <a href={b.link.href} target="_blank" rel="noopener" className="mt-1 inline-block text-sm font-medium text-forest underline underline-offset-2">
                  {b.link.label} ↗
                </a>
              )}
              {b.stack.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Stack">
                  {b.stack.map((s) => (
                    <li key={s} className="rounded-md bg-paper px-2 py-0.5 font-mono text-[0.72rem] text-muted">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              {b.id === 'regdocs' && <EvalTrail />}
              <div className="mt-4">
                <Lines group={anchor} />
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

/** The regdocs eval story as a tiny chart: the upgrade, then the regression the harness caught. */
function EvalTrail() {
  const points = [
    { label: 'Baseline', value: 95.7 },
    { label: 'Embedding upgrade', value: 96.7 },
    { label: 'Corpus grew', value: 91.3, alert: true },
  ]
  const min = 90
  const max = 98
  const x = (i: number) => 44 + i * 136
  const y = (v: number) => 22 + ((max - v) / (max - min)) * 52
  return (
    <figure className="mt-5 rounded-xl border border-rule bg-paper/60 p-3 sm:p-4">
      <figcaption className="flex items-baseline justify-between text-xs text-muted">
        <span>
          <span className="font-medium text-ink">hit@8</span> across releases
        </span>
        <span className="font-mono">eval-gated</span>
      </figcaption>
      <svg viewBox="0 0 360 100" className="mt-2 h-auto w-full max-w-lg" role="img" aria-label="hit@8 went from 95.7% to 96.7% after the embedding upgrade, then dropped to 91.3% when the corpus grew, which held the release.">
        <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" className="stroke-forest" strokeWidth="1.5" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="3.5" className={p.alert ? 'fill-coral' : 'fill-forest'} />
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className={`font-mono text-[11px] ${p.alert ? 'fill-coral-ink' : 'fill-ink'}`}>
              {p.value}%
            </text>
            <text x={x(i)} y="96" textAnchor="middle" className="fill-muted text-[10.5px]">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted">The drop was caught before release, root-caused to boilerplate sections colliding in retrieval, and half-recovered.</p>
    </figure>
  )
}
