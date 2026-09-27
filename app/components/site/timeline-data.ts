import { RESUME, resumeAnchor, type ResumeData } from '@/content/resume'

/**
 * Data for the career timeline (C7). Times are decimal years: 2024.5 is the start of July 2024.
 * Roles and community have ISO months; builds and study only have `period` strings, parsed here
 * (timeline.test.ts keeps every period in content/resume.ts parseable).
 */

export type TimelineLane = 'study' | 'work' | 'build' | 'community'

export interface TimelineBar {
  lane: TimelineLane
  /** Work has two tracks, so overlapping roles stack instead of colliding. */
  track: 0 | 1
  start: number
  end: number
  /** Short label drawn on or beside the bar. */
  label: string
  /** Full name, for the accessible label and tooltip. */
  title: string
  /** The role, build or community block the bar opens. Study bars have none. */
  anchor?: string
  /** Year-only dates: drawn with soft ends. */
  soft: boolean
  /** Still going: runs to `now`. */
  ongoing: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2024-08" → 2024.583 (the start of that month). */
export function fromIsoMonth(s: string): number {
  const [y, m] = s.split('-').map(Number)
  return y + (m - 1) / 12
}

/** A date as a decimal year. */
export function decimalYear(d: Date): number {
  return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365
}

/** "Jul 2026" or "Apr – Jul 2026" → [start, end), end being the end of the last month. Null if it doesn't parse. */
export function parseMonthPeriod(period: string): [number, number] | null {
  const m = /^([A-Z][a-z]{2})(?:\s*[–-]\s*([A-Z][a-z]{2}))?\s+(\d{4})$/.exec(period.trim())
  if (!m) return null
  const a = MONTHS.indexOf(m[1])
  const b = m[2] ? MONTHS.indexOf(m[2]) : a
  if (a < 0 || b < 0 || b < a) return null
  const y = Number(m[3])
  return [y + a / 12, y + (b + 1) / 12]
}

/** "2016 – 2019" → [2016, 2020); "2024" → [2024, 2025). Null if it doesn't parse. */
export function parseYearPeriod(period: string): [number, number] | null {
  const m = /^(\d{4})(?:\s*[–-]\s*(\d{4}))?$/.exec(period.trim())
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return b < a ? null : [a, b + 1]
}

/** Short study labels; the full credential is in the title. */
const STUDY_LABELS: Record<string, string> = { beng: 'BEng', ai: 'AI cert', tpm: 'TPM' }

/** "Create Club (via …)" → "Create Club"; "Eddy Solutions" → "Eddy". Labels must fit a bar. */
function shortCompany(company: string): string {
  return company.split(' (')[0].replace(/ (Solutions|Inc\.)$/, '')
}

/** Every bar on the timeline, oldest first within each lane. `now` is a decimal year. */
export function timelineBars(now: number, data: ResumeData = RESUME): TimelineBar[] {
  const bars: TimelineBar[] = []

  for (const e of data.education) {
    const p = parseYearPeriod(e.period)
    if (!p) continue
    bars.push({ lane: 'study', track: 0, start: p[0], end: p[1], label: STUDY_LABELS[e.id] ?? e.id, title: `${e.credential}, ${e.school}`, soft: true, ongoing: false })
  }

  // Roles, oldest first: a role that starts before the previous one ends goes on the second track.
  const lastEnd: [number, number] = [-Infinity, -Infinity]
  for (const r of [...data.experience].reverse()) {
    const start = fromIsoMonth(r.start)
    const end = r.end ? fromIsoMonth(r.end) + 1 / 12 : now
    const track: 0 | 1 = start >= lastEnd[0] ? 0 : 1
    lastEnd[track] = end
    bars.push({
      lane: 'work',
      track,
      start,
      end,
      label: shortCompany(r.company),
      title: `${r.role}, ${r.company}, ${r.period}`,
      anchor: resumeAnchor('exp', r.id),
      soft: false,
      ongoing: r.end === null,
    })
  }

  const builds = data.builds
    .map((b) => ({ b, p: parseMonthPeriod(b.period) }))
    .filter((x): x is { b: (typeof data.builds)[number]; p: [number, number] } => x.p !== null)
    .sort((x, y) => x.p[0] - y.p[0])
  for (const { b, p } of builds) {
    bars.push({ lane: 'build', track: 0, start: p[0], end: p[1], label: b.title, title: `${b.title}, ${b.period}`, anchor: resumeAnchor('build', b.id), soft: false, ongoing: false })
  }

  for (const c of data.community) {
    bars.push({
      lane: 'community',
      track: 0,
      start: fromIsoMonth(c.start),
      end: c.end ? fromIsoMonth(c.end) + 1 / 12 : now,
      label: c.company,
      title: `${c.role}, ${c.company}, ${c.period}`,
      anchor: resumeAnchor('community', c.id),
      soft: false,
      ongoing: c.end === null,
    })
  }

  return bars
}
