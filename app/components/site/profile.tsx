import { RESUME, resumeAnchor } from '@/content/resume'

// C4 Profile: the path from nuclear engineering to GenAI, three lines from the summary, and the
// full summary behind a disclosure that keeps the `r-summary` citation anchor.

export interface PathNode {
  year: string
  what: string
  where: string
}

const beng = RESUME.education.find((e) => e.id === 'beng')
const firstRole = RESUME.experience.reduce((a, b) => (b.start < a.start ? b : a))
const createClub = RESUME.experience.find((r) => r.id === 'create-club')
const current = RESUME.experience.find((r) => r.end === null) ?? RESUME.experience[0]

/** Three steps, every year and name read from the resume. A step whose entry is gone drops out. */
export const PATH: PathNode[] = [
  beng && { year: beng.period.slice(0, 4), what: 'Nuclear engineering', where: `BEng, ${beng.school.split(',')[0]}` },
  { year: firstRole.start.slice(0, 4), what: 'Software', where: `${firstRole.company}, then full-stack roles` },
  createClub && {
    year: createClub.start.slice(0, 4),
    what: 'GenAI infrastructure',
    where: `${createClub.company.split(' (')[0]}, now ${current.company}`,
  },
].filter((n): n is PathNode => Boolean(n))

/** Sentences of `text` matched by each pattern, in order. A pattern that no longer matches drops out. */
export function pickQuotes(text: string, patterns: RegExp[]): string[] {
  return patterns.flatMap((re) => text.match(re)?.[0] ?? [])
}

export const QUOTE_PATTERNS: RegExp[] = [/I work in focused deep dives[^.]*\./, /I design for reliability first[^.]*\./, /I build with Claude Code daily\./]

export const QUOTES: string[] = pickQuotes(RESUME.summary.join(' '), QUOTE_PATTERNS)

export function Profile(): React.ReactNode {
  const last = PATH.length - 1
  return (
    <section aria-label="Profile" className="pt-14 sm:pt-24">
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-x-14 gap-y-10 @max-[760px]:grid-cols-1">
        {/* The path. Each dot draws the rule to the next dot's centre (the dots paint over it), so the
            line starts and ends on a dot. The two segments show the two halves of one gradient. */}
        <ol className="grid grid-cols-[repeat(3,1fr)] @max-[760px]:grid-cols-1 @max-[760px]:gap-[26px]">
          {PATH.map((n, i) => (
            <li key={n.what} className="relative pr-3 pt-[50px] @max-[760px]:pl-[30px] @max-[760px]:pr-0 @max-[760px]:pt-0">
              <span
                aria-hidden
                className={`absolute left-0 top-[28px] z-[1] size-[18px] rounded-full border-2 border-forest @max-[760px]:top-1 ${
                  i === last ? 'bg-forest ring-[5px] ring-forest/18' : 'bg-paper'
                }`}
              />
              {i < last && (
                <span
                  aria-hidden
                  className={`absolute left-[9px] top-[36px] h-0.5 w-full bg-linear-to-r from-muted to-forest bg-size-[200%_100%] opacity-50 @max-[760px]:left-2 @max-[760px]:top-[13px] @max-[760px]:h-[calc(100%+26px)] @max-[760px]:w-0.5 @max-[760px]:bg-linear-to-b @max-[760px]:bg-size-[100%_200%] ${
                    i ? 'bg-right-bottom' : 'bg-left-top'
                  }`}
                />
              )}
              <span className="absolute left-0 top-0 font-mono text-[13px] text-muted @max-[760px]:static @max-[760px]:mb-1 @max-[760px]:block">{n.year}</span>
              <span className="type-display block text-[clamp(24px,3.4cqi,34px)]">{n.what}</span>
              <span className="mt-2 block text-sm text-muted">{n.where}</span>
            </li>
          ))}
        </ol>
        {/* The full summary opens for print, so the pull quotes would print twice. */}
        {QUOTES.length > 0 && (
          <ul className="grid gap-3.5 print:hidden">
            {QUOTES.map((q) => (
              <li key={q} className="border-l-2 border-rule pl-[18px] text-[19px] leading-[1.4]">
                {q}
              </li>
            ))}
          </ul>
        )}
      </div>
      <details id={resumeAnchor('summary')} className="disclose group mt-7 scroll-mt-24 rounded-md border-t border-rule">
        <summary className="flex items-center gap-2.5 py-3.5 font-medium">
          <span aria-hidden className="size-2.5 flex-none -rotate-45 border-b-2 border-r-2 border-current opacity-60 transition-transform duration-250 group-open:rotate-45" />
          Read the full summary
        </summary>
        <div className="grid max-w-[64ch] gap-3 pb-3 text-[17px] leading-relaxed">
          {[RESUME.pitch, ...RESUME.summary].map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </details>
    </section>
  )
}
