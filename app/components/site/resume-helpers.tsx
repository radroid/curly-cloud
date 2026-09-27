import { Fragment } from 'react'
import { RESUME, type ResumeBullet } from '@/content/resume'

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

const ALL_BULLETS: ResumeBullet[] = [
  ...RESUME.experience.flatMap((r) => r.bullets),
  ...RESUME.builds.flatMap((b) => b.bullets),
  ...RESUME.community.flatMap((c) => c.bullets),
]

/** How many resume lines carry each tag. Filters with no lines are hidden. */
export const TAG_COUNTS: Record<string, number> = ALL_BULLETS.reduce<Record<string, number>>((acc, b) => {
  for (const t of b.tags) acc[t] = (acc[t] ?? 0) + 1
  return acc
}, {})

export const RESUME_LINE_COUNT = ALL_BULLETS.length

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
