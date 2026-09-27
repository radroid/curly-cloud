import { Fragment } from 'react'
import { RESUME, resumeAnchor, type ResumeBullet } from '@/content/resume'

/** Short chip labels for the skill filter, keyed by the tag ids used on resume bullets. */
export const FILTERS: { group: string; items: { id: string; label: string }[] }[] = [
  {
    group: 'AI',
    items: [
      { id: 'mcp', label: 'MCP' },
      { id: 'agents', label: 'Agents' },
      { id: 'rag', label: 'RAG' },
      { id: 'evals', label: 'Evals' },
      { id: 'vector-search', label: 'Vector search' },
      { id: 'rrf', label: 'Fusion & rerank' },
      { id: 'citations', label: 'Citations' },
      { id: 'guardrails', label: 'Guardrails' },
      { id: 'llm-apis', label: 'LLM APIs' },
      { id: 'langchain', label: 'LangChain' },
      { id: 'claude-code', label: 'Codex/Claude CLI' },
    ],
  },
  {
    group: 'Stack',
    items: [
      { id: 'python', label: 'Python' },
      { id: 'typescript', label: 'TypeScript' },
      { id: 'csharp', label: 'C#/.NET' },
      { id: 'nextjs', label: 'Next.js' },
      { id: 'postgres', label: 'Postgres' },
      { id: 'aws', label: 'AWS' },
      { id: 'azure', label: 'Azure' },
      { id: 'gcp', label: 'GCP' },
      { id: 'cloudflare', label: 'Cloudflare' },
      { id: 'docker', label: 'Docker & CI/CD' },
      { id: 'kafka', label: 'Kafka' },
    ],
  },
  {
    group: 'Practice',
    items: [
      { id: 'community', label: 'Community' },
      { id: 'leadership', label: 'Leadership' },
      { id: 'product', label: 'Product' },
      { id: 'monitoring', label: 'Monitoring' },
      { id: 'etl', label: 'ETL & APIs' },
      { id: 'pii', label: 'Privacy' },
      { id: 'rate-limiting', label: 'Rate limiting' },
    ],
  },
]

export const FILTER_LABELS: Record<string, string> = Object.fromEntries(
  FILTERS.flatMap((g) => g.items.map((i) => [i.id, i.label])),
)

export interface ResumeLine {
  anchor: string
  /** Anchor of the role, build or community block the line belongs to. */
  group: string
  bullet: ResumeBullet
}

/** Every citable resume line, in page order. */
export const LINES: ResumeLine[] = [
  ...RESUME.experience.flatMap((r) => r.bullets.map((b) => ({ anchor: resumeAnchor('exp', r.id, b.id), group: resumeAnchor('exp', r.id), bullet: b }))),
  ...RESUME.builds.flatMap((x) => x.bullets.map((b) => ({ anchor: resumeAnchor('build', x.id, b.id), group: resumeAnchor('build', x.id), bullet: b }))),
  ...RESUME.community.flatMap((c) => c.bullets.map((b) => ({ anchor: resumeAnchor('community', c.id, b.id), group: resumeAnchor('community', c.id), bullet: b }))),
]

const LINE_BY_ANCHOR: Record<string, ResumeLine> = Object.fromEntries(LINES.map((l) => [l.anchor, l]))

/** How many resume lines carry each tag. Filters with no lines are hidden. */
export const TAG_COUNTS: Record<string, number> = LINES.reduce<Record<string, number>>((acc, l) => {
  for (const t of l.bullet.tags) acc[t] = (acc[t] ?? 0) + 1
  return acc
}, {})

export const RESUME_LINE_COUNT = LINES.length

/** "1 line", "7 lines". */
export function nLines(n: number): string {
  return `${n} line${n === 1 ? '' : 's'}`
}

/** Lines in a role, build or community block that carry a tag. */
export function matchesIn(group: string, tag: string | null): number {
  if (!tag) return 0
  return LINES.filter((l) => l.group === group && l.bullet.tags.includes(tag)).length
}

/** Whether the skill filter dims an anchor: a line without the tag, or a block with no such line. */
export function dimmedBy(skill: string | null, anchor: string): boolean {
  if (!skill) return false
  const line = LINE_BY_ANCHOR[anchor]
  if (line) return !line.bullet.tags.includes(skill)
  const inGroup = LINES.filter((l) => l.group === anchor)
  return inGroup.length > 0 && !inGroup.some((l) => l.bullet.tags.includes(skill))
}

/** How many anchors the latest answer cited inside a block (the block itself or its lines). */
export function citedIn(cited: Record<string, number[]>, group: string): number {
  return Object.keys(cited).filter((a) => a === group || LINE_BY_ANCHOR[a]?.group === group).length
}

/** A natural question about one resume line, for the "Ask about this" buttons. */
export function questionAbout(text: string): string {
  const first = text.split(/(?<=[.:;])\s/)[0].replace(/[.:;]$/, '')
  const short = first.length > 120 ? `${first.slice(0, 117).replace(/\s+\S*$/, '')}…` : first
  return `Tell me the story behind this: “${short}”`
}

// Numbers that carry an outcome (80+, 60%, 150,000+, 15 seconds to 5). Only at word starts,
// so model names like text-embedding-3-large and hit@8 stay untouched.
const METRIC = /(?<=^|[\s(~])\d(?:[\d,.]*\d)?(?:%|\+|K\b)?/g

/** Render resume text with its numbers emphasised. */
export function Emphasized({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(METRIC)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    parts.push(
      <span key={i} className="font-semibold text-forest tabular-nums">
        {m[0]}
      </span>,
    )
    last = i + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <Fragment>{parts}</Fragment>
}
