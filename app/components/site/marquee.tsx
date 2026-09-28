'use client'

import { useState } from 'react'
import { RESUME } from '@/content/resume'

const current = RESUME.experience.find((r) => r.end === null) ?? RESUME.experience[0]
const firstYear = Math.min(...RESUME.experience.map((r) => Number(r.start.slice(0, 4))))

/** C3 status items, from content/resume.ts where the CV has them. */
const ITEMS: [key: string, value: string][] = [
  ['now', `${current.role}, ${current.company}`],
  ['base', RESUME.location.split(',')[0]],
  ['stack', 'TypeScript, Python, C#'],
  ['shipping since', String(firstYear)],
]

/**
 * Companies Raj would love to join. Logos are one-colour SVGs in public/logos (inner detail kept as
 * opacity), drawn as masks so they take the stage's text colour. `ratio` is the viewBox's width over
 * height; `height` (px) is tuned by eye so each logo carries about the same visual weight.
 */
const DREAM_TEAMS: { name: string; file: string; ratio: number; height: number }[] = [
  { name: 'Anthropic', file: 'anthropic', ratio: 8.906, height: 15 },
  { name: 'Google', file: 'google', ratio: 3.038, height: 24 },
  { name: 'Apple', file: 'apple', ratio: 0.814, height: 25 },
  { name: 'Vercel', file: 'vercel', ratio: 5.032, height: 19 },
  { name: 'Clipboard', file: 'clipboard', ratio: 3.522, height: 21 },
  { name: 'Wealthsimple', file: 'wealthsimple', ratio: 6.175, height: 18 },
  { name: 'FreshBooks', file: 'freshbooks', ratio: 4.617, height: 21 },
  { name: 'Purpose Investments', file: 'purpose', ratio: 2.997, height: 26 },
  { name: 'FrontFundr', file: 'frontfundr', ratio: 5.364, height: 20 },
  { name: 'Hubdoc', file: 'hubdoc', ratio: 3.544, height: 26 },
  { name: 'KOHO', file: 'koho', ratio: 4, height: 17 },
]

function Key({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden className="mr-3.5 size-[5px] shrink-0 rounded-full bg-term-accent/60" />
      <span className="rounded border border-term-text/25 px-1.5 py-1 font-mono text-[11px] font-medium leading-none text-term-dim">{children}</span>
    </>
  )
}

function Items({ copy = false }: { copy?: boolean }) {
  const li = 'flex items-center gap-3 whitespace-nowrap py-[17px] pr-[26px] still:whitespace-normal still:py-2.5'
  return (
    <ul aria-hidden={copy || undefined} className={`m-0 flex list-none p-0 still:flex-wrap ${copy ? 'still:hidden' : ''}`}>
      {ITEMS.map(([k, v]) => (
        <li key={k} className={li}>
          <Key>{k}</Key>
          <span className="type-display text-[26px] leading-none tracking-[0.02em]">{v}</span>
        </li>
      ))}
      <li className={`${li} still:basis-full still:flex-wrap`}>
        <Key>dream teams</Key>
        <span className="flex items-center gap-x-9 gap-y-3 pl-2 still:flex-[1_1_18rem] still:flex-wrap still:gap-x-8">
          {DREAM_TEAMS.map((t) => (
            <span
              key={t.file}
              role="img"
              aria-label={t.name}
              className="shrink-0 bg-term-text mask-contain mask-center mask-no-repeat"
              style={{ height: t.height, aspectRatio: t.ratio, maskImage: `url(/logos/${t.file}.svg)` }}
            />
          ))}
        </span>
      </li>
    </ul>
  )
}

/**
 * C3. A looping status ticker on the stage: where Raj is now, then the teams he'd love to join. It
 * pauses on hover and focus, and the button pauses it for good (WCAG 2.2.2). With motion off it's a
 * static, wrapped row.
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
