'use client'

import { useEffect, useRef, type ComponentType } from 'react'
import { RESUME, resumeAnchor, type ResumeBuild } from '@/content/resume'
import { useInView } from '@/app/lib/use-in-view'
import { useMotionTier } from '@/app/lib/use-motion-tier'
import { Lines } from './resume'
import { citedIn, LINES, matchesIn, nLines } from './resume-helpers'
import { useSite, useSkillHover } from './site-context'

// C9 Independent builds: featured cards lead with a diagram, the rest are compact. Every number and
// label in a diagram or chip comes from that build's lines in content/resume.ts (builds.test.ts).

export interface BuildFact {
  value: string
  label: string
  /** The words in the build's lines that state it. */
  match: string
}

export const BUILD_FACTS: Record<string, BuildFact[]> = {
  regdocs: [
    { value: '40+', label: 'documents', match: '40+ Canadian Nuclear Safety Commission documents' },
    { value: '14', label: 'safety areas', match: 'all 14 safety and control areas' },
    { value: 'shall', label: 'vs should, shown apart', match: 'requirements (shall/must) are visually separated from guidance (should/may)' },
  ],
  jobsearch: [
    { value: '~100K', label: 'postings', match: '~100K US job postings' },
    { value: '8 GB', label: 'JSONL', match: '8 GB JSONL' },
    { value: '3', label: 'named vectors', match: 'three named embedding vectors' },
  ],
}

/** hit@8 at each release in the regdocs evals line. */
export const EVAL_POINTS: { label: string[]; value: number; held?: boolean }[] = [
  { label: ['baseline'], value: 95.7 },
  { label: ['embedding', 'upgrade'], value: 96.7 },
  { label: ['corpus grew,', 'release held'], value: 91.3, held: true },
]

/** The three named vectors each job posting is embedded as. */
export const SEARCH_LANES = ['explicit', 'inferred', 'company'] as const

/** Plays once as the diagram scrolls into view; the server HTML and the still tier show the end state. */
function usePlay<T extends Element>(): { ref: (el: T | null) => void; motion: boolean; play: boolean } {
  const [ref, inView] = useInView<T>({ once: true, threshold: 0.35 })
  const motion = useMotionTier().tier !== 'saver'
  return { ref, motion, play: motion && inView }
}

function EvalChart() {
  const { ref, motion, play } = usePlay<SVGSVGElement>()
  const x = (i: number) => 40 + i * 110
  const y = (v: number) => 36 + ((98 - v) / 8) * 52
  const line = EVAL_POINTS.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value).toFixed(1)}`).join(' ')
  const [a, b, c] = EVAL_POINTS
  // Hidden only once hydrated with motion on and not yet seen, so no-JS, still and print readers get the line.
  const draw = !motion || play
  return (
    <svg
      ref={ref}
      viewBox="0 0 300 124"
      role="img"
      aria-label={`hit@8 went from ${a.value}% to ${b.value}% after an embedding upgrade, then fell to ${c.value}% when the corpus grew, and the release was held.`}
      className="block h-auto w-full overflow-visible font-mono"
    >
      <text x="0" y="10" fontSize="10" className="fill-term-dim">
        hit@8 across releases
      </text>
      <path
        d={line}
        pathLength={1}
        fill="none"
        strokeWidth="2"
        strokeLinejoin="round"
        className={`stroke-term-accent [stroke-dasharray:1] still:[stroke-dashoffset:0] print:[stroke-dashoffset:0] ${draw ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]'} ${play ? 'transition-[stroke-dashoffset] duration-[1400ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]' : ''}`}
      />
      {EVAL_POINTS.map((p, i) => (
        <g key={p.value}>
          <circle cx={x(i)} cy={y(p.value)} r="4.5" className={p.held ? 'fill-coral-glow' : 'fill-term-accent'} />
          <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="12" className={p.held ? 'fill-coral-glow' : 'fill-term-text'}>
            {p.value}%
          </text>
          <text x={x(i)} y="108" textAnchor="middle" fontSize="9" className="fill-term-dim">
            {p.label.map((t, k) => (
              <tspan key={t} x={x(i)} dy={k ? 11 : 0}>
                {t}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </svg>
  )
}

// The packet runs along the middle lane and stops short of "top 10" so it never covers the label.
const PACKET_PATH = 'M24 59 L262 59'
const PACKET_END = { x: 262, y: 59 }

function SearchPipeline() {
  const { ref, play } = usePlay<SVGSVGElement>()
  const motion = useRef<SVGAnimateMotionElement>(null)
  useEffect(() => {
    if (play) motion.current?.beginElement()
  }, [play])
  const lane = (i: number) => 28 + i * 31
  return (
    <svg
      ref={ref}
      viewBox="0 0 312 118"
      role="img"
      aria-label={`Query pipeline: a query is parsed into intent, searched over three named vectors (${SEARCH_LANES.join(', ')}), fused with reciprocal rank fusion, and returned as a top 10.`}
      className="block h-auto w-full overflow-visible font-mono"
    >
      <text x="0" y="10" fontSize="10" className="fill-term-dim">
        query pipeline
      </text>
      <g fill="none" className="stroke-term-dim">
        <rect x="0" y="48" width="48" height="22" rx="4" />
        <path d="M48 59 H60" />
        <rect x="60" y="48" width="48" height="22" rx="4" />
        {SEARCH_LANES.map((l, i) => (
          <path key={l} d={`M108 59 C128 59 128 ${lane(i)} 146 ${lane(i)} M208 ${lane(i)} C220 ${lane(i)} 220 59 228 59`} />
        ))}
      </g>
      {SEARCH_LANES.map((l, i) => (
        <rect key={l} x="146" y={lane(i) - 10} width="62" height="20" rx="4" className="fill-term-accent/15" />
      ))}
      <rect x="228" y="48" width="26" height="22" rx="4" className="fill-sun" />
      {/* Drawn under the labels so text stays readable as it passes. */}
      <circle r="3.5" cx={play ? 0 : PACKET_END.x} cy={play ? 0 : PACKET_END.y} className="fill-sun">
        {play && <animateMotion ref={motion} begin="indefinite" dur="3s" repeatCount="3" fill="freeze" path={PACKET_PATH} />}
      </circle>
      <g fontSize="10" textAnchor="middle" className="fill-term-text">
        <text x="24" y="63">
          query
        </text>
        <text x="84" y="63">
          intent
        </text>
        {SEARCH_LANES.map((l, i) => (
          <text key={l} x="177" y={lane(i) + 3.5} fontSize="9.5" className="fill-term-accent">
            {l}
          </text>
        ))}
        <text x="241" y="62.5" fontSize="9" className="fill-ink">
          rrf
        </text>
        <text x="270" y="63" textAnchor="start">
          top 10
        </text>
      </g>
    </svg>
  )
}

const DIAGRAMS: Record<string, ComponentType> = { regdocs: EvalChart, jobsearch: SearchPipeline }

const chip = 'rounded-md bg-rule/50 px-2 py-1 font-mono text-xs'

/**
 * A block's lines behind `▸ N lines`, with the latest answer's `N cited` and the skill lens's
 * `N match` beside the count. Setting a skill filter opens it when a line matches.
 */
export function LinesBox({ group, id, tone = 'border-rule text-muted', children }: { group: string; id: string; tone?: string; children?: React.ReactNode }) {
  const { skill, cited } = useSite()
  const [hover] = useSkillHover()
  const box = useRef<HTMLDetailsElement>(null)
  const count = LINES.filter((l) => l.group === group).length
  const nCited = citedIn(cited, group)
  const nMatch = matchesIn(group, hover ?? skill)
  useEffect(() => {
    if (skill && matchesIn(group, skill) && box.current) box.current.open = true
  }, [skill, group])
  return (
    // The browser may open it before hydration (a #r-… link or find-in-page lands inside it).
    <details ref={box} id={id} className="disclose group/lines" suppressHydrationWarning>
      <summary className={`flex min-h-11 items-center gap-2.5 border-t py-2 font-mono text-[13px] hover:text-ink ${tone}`}>
        <span aria-hidden className="size-2.5 shrink-0 -rotate-45 border-b-2 border-r-2 border-current opacity-60 transition-[rotate,translate] duration-200 group-open/lines:-translate-y-0.5 group-open/lines:rotate-45" />
        {nLines(count)}
        {nCited > 0 && <span className="rounded bg-coral-ink px-[7px] py-0.5 text-[11px] font-medium leading-4 text-white">{nCited} cited</span>}
        {nMatch > 0 && <span className="rounded bg-forest px-[7px] py-0.5 text-[11px] font-medium leading-4 text-paper">{nMatch} match</span>}
      </summary>
      {/* Room above the first line for its floating "Ask about this". */}
      <div className="py-3">
        {children}
        <Lines group={group} />
      </div>
    </details>
  )
}

function BuildCard({ build, Diagram }: { build: ResumeBuild; Diagram?: ComponentType }) {
  const anchor = resumeAnchor('build', build.id)
  const facts = BUILD_FACTS[build.id] ?? []
  const linesId = `lines-${build.id}`
  const many = build.bullets.length > 1
  return (
    // A timeline bar jumping to the card opens its lines too (data-opens, see focusAnchor).
    <article id={anchor} data-opens={many ? linesId : undefined} className="scroll-mt-24 overflow-hidden rounded-[18px] border border-rule bg-white">
      {Diagram && (
        // Light-on-dark, so the band keeps its background when printed.
        <div className="bg-night px-5 pb-3.5 pt-[18px] text-term-text [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
          <Diagram />
        </div>
      )}
      <div className="px-5 pt-[18px]">
        <p className="font-mono text-[12.5px] text-muted">{build.period}</p>
        <h4 className="mb-3 mt-1.5 text-xl font-semibold leading-[1.3] tracking-tight">{build.title}</h4>
        {build.link && (
          <a
            href={build.link.href}
            target="_blank"
            rel="noopener"
            className="-mt-4 mb-0.5 inline-flex min-h-11 items-center text-sm underline decoration-current/45 decoration-1 underline-offset-4 hover:decoration-current"
          >
            {build.link.label} ↗
          </a>
        )}
        {facts.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Facts">
            {facts.map((f) => (
              <li key={f.label} className={chip}>
                <b className="font-medium">{f.value}</b> {f.label}
              </li>
            ))}
          </ul>
        )}
        {build.stack.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Stack">
            {build.stack.map((s) => (
              <li key={s} className={chip}>
                {s}
              </li>
            ))}
          </ul>
        )}
        {many ? (
          <LinesBox group={anchor} id={linesId} />
        ) : (
          <div className="border-t border-rule py-3">
            <Lines group={anchor} />
          </div>
        )}
      </div>
    </article>
  )
}

export function Builds() {
  const featured = RESUME.builds.filter((b) => DIAGRAMS[b.id])
  const compact = RESUME.builds.filter((b) => !DIAGRAMS[b.id])
  return (
    <div>
      <h3 className="type-display mb-4 mt-14 text-[32px]">Independent builds</h3>
      <div className="grid items-start gap-6 @min-[820px]:grid-cols-2">
        {[...featured, ...compact].map((b) => (
          <BuildCard key={b.id} build={b} Diagram={DIAGRAMS[b.id]} />
        ))}
      </div>
    </div>
  )
}
