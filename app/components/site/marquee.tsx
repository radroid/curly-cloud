'use client'

import { useState } from 'react'
import { RESUME } from '@/content/resume'

const current = RESUME.experience.find((r) => r.end === null) ?? RESUME.experience[0]
const firstYear = Math.min(...RESUME.experience.map((r) => Number(r.start.slice(0, 4))))

/** C3 status items, from content/resume.ts where the CV has them. */
const ITEMS: [key: string, value: string][] = [
  ['now', `${current.role}, ${current.company}`],
  ['base', RESUME.location.split(',')[0]],
  ['building', 'MCP servers, RAG pipelines, agents, evals'],
  ['stack', 'TypeScript, Python, C#'],
  ['shipping since', String(firstYear)],
  ['for agents', 'curlycloud.dev/mcp'],
  ...RESUME.community.slice(0, 1).map((c): [string, string] => ['community', c.company]),
]

function Items({ copy = false }: { copy?: boolean }) {
  return (
    <ul aria-hidden={copy || undefined} className={`m-0 flex list-none p-0 still:flex-wrap ${copy ? 'still:hidden' : ''}`}>
      {ITEMS.map(([k, v]) => (
        <li key={k} className="flex items-center gap-3 whitespace-nowrap py-[17px] pr-[26px] still:whitespace-normal still:py-2.5">
          <span aria-hidden className="mr-3.5 size-[5px] shrink-0 rounded-full bg-term-accent/60" />
          <span className="rounded border border-term-text/25 px-1.5 py-1 font-mono text-[11px] font-medium leading-none text-term-dim">{k}</span>
          <span className="type-display text-[26px] leading-none tracking-[0.02em]">{v}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * C3. A looping status ticker on the stage. It pauses on hover and focus, and the button pauses it
 * for good (WCAG 2.2.2). With motion off it's a static, wrapped row.
 */
export function Marquee(): React.ReactNode {
  const [paused, setPaused] = useState(false)
  return (
    <section aria-label="Status" className="group relative overflow-hidden border-y border-term-text/16 bg-night text-term-text print:hidden">
      <div
        className={[
          'flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]',
          'still:w-auto still:animate-none still:px-gutter still:py-2',
          paused ? '[animation-play-state:paused]' : '',
        ].join(' ')}
      >
        <Items />
        <Items copy />
      </div>
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? 'Play the ticker' : 'Pause the ticker'}
        onClick={() => setPaused((p) => !p)}
        className="absolute right-2.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-term-text/30 bg-night text-term-text transition-colors hover:border-term-text still:hidden"
      >
        <svg aria-hidden viewBox="0 0 12 12" className="size-3" fill="currentColor">
          {paused ? <path d="M3 1.5v9l7.5-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
        </svg>
      </button>
    </section>
  )
}
