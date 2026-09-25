/**
 * Constants and pure helpers shared by the studio's routes and its client components.
 * No server imports here: this file ends up in the browser bundle.
 */
import type { Channel, SourceInput, SourceKind } from '@/lib/rag/types'

export const SOURCE_KINDS: SourceKind[] = ['resume', 'profile', 'interview', 'note', 'correction']
export const CHANNELS: Channel[] = ['web', 'terminal', 'mcp', 'studio']

export const SOURCES_PAGE_SIZE = 50
export const LOGS_PAGE_SIZE = 40

/** Kinds generated from content/resume.ts. Editing them in D1 would be overwritten by the next seed. */
export const READ_ONLY_KINDS: SourceKind[] = ['resume', 'profile']
export const READ_ONLY_MESSAGE = 'Resume and profile sources are read-only: edit content/resume.ts and re-seed.'

export function isReadOnlyKind(kind: SourceKind | null | undefined): boolean {
  return kind != null && READ_ONLY_KINDS.includes(kind)
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + '…'
}

// ── Corrections ──────────────────────────────────────────────────────────────

export const CORRECTION_PREFIX = 'correction:'
const ANSWER_LABEL = "How I'd actually answer: "

export function correctionSourceId(logId: string): string {
  return CORRECTION_PREFIX + logId
}

/** The private source a correction becomes. Re-correcting the same log overwrites it (same id). */
export function correctionInput(log: { id: string; question: string; channel: Channel }, correction: string): SourceInput {
  return {
    id: correctionSourceId(log.id),
    kind: 'correction',
    visibility: 'private',
    title: truncate(log.question, 160),
    topic: 'notes',
    anchor: null,
    body: `Question: ${log.question.trim()}\n${ANSWER_LABEL}${correction.trim()}`,
    meta: { logId: log.id, channel: log.channel },
  }
}

/** Recover the corrected answer from a correction body, for prefilling the editor. */
export function correctionText(body: string): string {
  const at = body.indexOf(ANSWER_LABEL)
  return at === -1 ? body : body.slice(at + ANSWER_LABEL.length)
}

// ── Formatting ───────────────────────────────────────────────────────────────

const numberFormat = new Intl.NumberFormat('en-US')
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export function fmtNum(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : numberFormat.format(n)
}

export function fmtCompact(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : compactFormat.format(n)
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`
}

export function fmtScore(value: number | null | undefined, digits = 3): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

/** "3m ago", "5h ago", "2d ago", then a date. */
export function timeAgo(at: number | null | undefined, now = Date.now()): string {
  if (!at) return '—'
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 14) return `${d}d ago`
  return fmtDate(at)
}

export function fmtDate(at: number | null | undefined): string {
  if (!at) return '—'
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(at: number | null | undefined): string {
  if (!at) return '—'
  return new Date(at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Split an answer into text and `[n]` citation markers (also `[1, 3]`). */
export function splitCitations(text: string): ({ type: 'text'; text: string } | { type: 'cite'; n: number })[] {
  const out: ({ type: 'text'; text: string } | { type: 'cite'; n: number })[] = []
  const re = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    for (const n of m[1].split(',')) out.push({ type: 'cite', n: Number(n.trim()) })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

export function citedNumbers(text: string): Set<number> {
  const set = new Set<number>()
  for (const part of splitCitations(text)) if (part.type === 'cite') set.add(part.n)
  return set
}

/** Fit checks log their assessment as JSON; show it as prose in the studio. */
export function readableAnswer(kind: 'ask' | 'fit', answer: string): string {
  if (kind !== 'fit') return answer
  try {
    const a = JSON.parse(answer) as {
      overall?: { verdict?: string; score?: number; summary?: string }
      technical?: { score?: number; summary?: string }
      culture?: { score?: number; summary?: string }
      unknowns?: string[]
    }
    return [
      `${a.overall?.verdict ?? 'unknown'} (${a.overall?.score ?? '?'}/5): ${a.overall?.summary ?? ''}`,
      a.technical ? `Technical ${a.technical.score}/5: ${a.technical.summary}` : '',
      a.culture ? `Culture ${a.culture.score}/5: ${a.culture.summary}` : '',
      a.unknowns?.length ? `Unknowns: ${a.unknowns.join('; ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  } catch {
    return answer
  }
}
