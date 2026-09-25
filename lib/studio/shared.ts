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
export const CORRECTION_TITLE_MAX = 160
const ANSWER_LABEL = "How I'd actually answer: "

export function correctionSourceId(logId: string): string {
  return CORRECTION_PREFIX + logId
}

// URL-shaped text: anything with a scheme (https://, javascript:, mailto:), www. hosts,
// host.tld/path, and bare hosts on common TLDs. Tech names (Node.js, ASP.NET, socket.io,
// Node.js/Deno) are left alone.
const URL_LIKE = new RegExp(
  [
    String.raw`(?:\b[a-z][a-z0-9+.-]*:\/\/|\b(?:mailto|javascript|data|tel|sms):(?=\S)|\bwww\.)\S*`,
    String.raw`\b(?:[a-z0-9-]+\.)+(?!(?:js|ts|jsx|tsx|py|rb|md|json|ya?ml|txt|html?|css)\/)[a-z]{2,}\/\S*`,
    String.raw`\b(?:[a-z0-9-]+\.)+(?:com|org|xyz|top|info|biz|ru|cn|tk|click|link|site|online|shop|store|app|dev|ai|co|me|ly|gg|to|cc|ws|us|uk)\b`,
  ].join('|'),
  'gi',
)
const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

/** Length of the URL in a greedy match, leaving trailing punctuation and unbalanced closers to the sentence. */
function urlLength(match: string): number {
  let end = match.length
  while (end > 0) {
    const c = match[end - 1]
    const opener = CLOSERS[c]
    const url = match.slice(0, end)
    if (/[.,;:!?'"<>]/.test(c) || (opener && url.split(c).length > url.split(opener).length)) end--
    else break
  }
  return end
}

/**
 * A correction's title is its public citation label, and it usually starts as a visitor's
 * question. Strip URLs and emails so visitor-written links can't surface to other visitors.
 * Used to prefill the studio form and again on the server for whatever title is saved.
 */
export function correctionTitle(text: string): string {
  const clean = text
    .replace(EMAIL_LIKE, ' ')
    .replace(URL_LIKE, (m) => ' ' + m.slice(urlLength(m)))
    .replace(/\(\s*\)|\[\s*\]|<\s*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,;:)\]])/g, '$1')
    .replace(/^[\s,;:.-]+|[\s,;:-]+$/g, '')
    .trim()
  return /[\p{L}\p{N}]/u.test(clean) ? truncate(clean, CORRECTION_TITLE_MAX) : 'Correction'
}

/**
 * The private source a correction becomes. Re-correcting the same log overwrites it (same id).
 * `title` defaults to the visitor's question; either way URLs and emails are stripped.
 */
export function correctionInput(
  log: { id: string; question: string; channel: Channel },
  correction: string,
  title?: string | null,
): SourceInput {
  return {
    id: correctionSourceId(log.id),
    kind: 'correction',
    visibility: 'private',
    title: correctionTitle(title?.trim() ? title : log.question),
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
