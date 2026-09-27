import { resumeAnchor } from '@/content/resume'

/**
 * The numbers shown as instruments (C5). Each one comes from a resume line: `anchor` is that
 * line's citation anchor and every `match` string must appear in its text word for word
 * (stats.test.ts), so a resume edit can't silently leave a stale number on the page.
 */

export type StatViz = 'years' | 'devices' | 'processes' | 'deploy' | 'postings' | 'docs'

export interface Stat {
  id: string
  /** Final value; the counter animates to it. */
  value: number
  /** Start of a "from → to" stat (deploys: 15 → 2). */
  from?: number
  /** Shown after the number: '+', 'K', ' min'. */
  suffix: string
  label: string
  anchor: string
  /** Short name of the source, for the `source: …` link. */
  source: string
  /** Literal substrings of the source line that back the number and the label. */
  match: string[]
  viz: StatViz
}

export const STATS: Stat[] = [
  {
    id: 'years',
    value: 6,
    suffix: '',
    label: 'years shipping production systems',
    anchor: resumeAnchor('summary'),
    source: 'Summary',
    match: ['6 years shipping production systems'],
    viz: 'years',
  },
  {
    id: 'devices',
    value: 150_000,
    suffix: '+',
    label: 'LoRaWAN devices whose telemetry my scripts turn into actionable insights',
    anchor: resumeAnchor('exp', 'eddy', 'services'),
    source: 'Eddy Solutions',
    match: ['150,000+ LoRaWAN devices', 'actionable insights'],
    viz: 'devices',
  },
  {
    id: 'processes',
    value: 80,
    suffix: '+',
    label: 'weekly processes replaced by LangChain agents, about 60% less manual work',
    anchor: resumeAnchor('exp', 'create-club', 'beverage-agents'),
    source: 'Create Club',
    match: ['LangChain agents', 'replacing 80+ weekly processes', 'cutting manual work by about 60%'],
    viz: 'processes',
  },
  {
    id: 'deploys',
    value: 2,
    from: 15,
    suffix: ' min',
    label: 'deploys, down from 15 minutes with a new AWS pipeline',
    anchor: resumeAnchor('exp', 'pinhous', 'cicd'),
    source: 'Pinhous',
    match: ['AWS deploy pipeline', 'from 15 minutes to 2'],
    viz: 'deploy',
  },
  {
    id: 'postings',
    value: 100,
    suffix: 'K',
    label: 'job postings searchable in plain language, three vectors each',
    anchor: resumeAnchor('build', 'jobsearch', 'vectors'),
    source: 'Job search',
    match: ['~100K', 'three named embedding vectors per posting'],
    viz: 'postings',
  },
  {
    id: 'docs',
    value: 40,
    suffix: '+',
    label: 'nuclear regulatory documents grounded in one cited RAG chat',
    anchor: resumeAnchor('build', 'regdocs', 'corpus'),
    source: 'Regulatory assistant',
    match: ['RAG chat over 40+ Canadian Nuclear Safety Commission documents', '15 priority REGDOCs plus 26 best-practice'],
    viz: 'docs',
  },
]

/** 150000 → "150,000". */
export function formatStat(n: number): string {
  return n.toLocaleString('en-US')
}
