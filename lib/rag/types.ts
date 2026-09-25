/**
 * Contracts shared by the clone's server (lib/rag), its routes, and every client
 * (website, terminal, studio, MCP). Changing a shape here is a cross-stream change —
 * update CLONE-PLAN.md in the same commit.
 */

export type SourceKind = 'resume' | 'profile' | 'interview' | 'note' | 'correction'
export type Visibility = 'public' | 'private'
export type Channel = 'web' | 'terminal' | 'mcp' | 'studio'

/** What gets ingested. `id` is stable and idempotent: re-ingesting the same id updates in place. */
export interface SourceInput {
  id: string
  kind: SourceKind
  visibility: Visibility
  /** Citation label. For interview answers this is the question. */
  title: string
  /** Theme / stack id, e.g. "principles", "experience". */
  topic?: string | null
  /** DOM id on the website for public sources, e.g. "r-exp-eddy-2". */
  anchor?: string | null
  body: string
  meta?: Record<string, unknown>
}

export interface SourceRecord extends Required<Omit<SourceInput, 'meta'>> {
  meta: Record<string, unknown>
  contentHash: string
  createdAt: number
  updatedAt: number
  chunkCount: number
}

export interface IngestResult {
  upserted: number
  unchanged: number
  deleted: number
  chunks: number
  embedded: number
  errors: { id: string; message: string }[]
  corpusVersion: number
}

/** A numbered source shown to the model and, as a label, to the reader. */
export interface CitationSource {
  n: number
  id: string
  kind: SourceKind
  visibility: Visibility
  title: string
  topic: string | null
  anchor: string | null
  /** Only ever set for public sources. Private text never leaves the server. */
  snippet: string | null
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AnswerRequest {
  messages: ChatTurn[]
  channel: Channel
  /** Pseudonymous visitor id (lib/security clientIdFromRequest) or `key:<id>` for MCP keys. */
  clientId: string
  keyId?: string | null
}

export type AnswerErrorCode = 'rate_limited' | 'budget_exceeded' | 'bad_request' | 'unavailable' | 'internal'

export type AnswerEvent =
  | { type: 'sources'; sources: CitationSource[] }
  | { type: 'delta'; text: string }
  | {
      type: 'done'
      /** Source numbers the answer actually cited, in first-use order. */
      cited: number[]
      provider: 'anthropic' | 'workers-ai'
      model: string
      latencyMs: number
      /** True when the verbatim guard cut the answer short. */
      guarded: boolean
      logId: string | null
    }
  | { type: 'error'; code: AnswerErrorCode; message: string }

export interface Answer {
  text: string
  sources: CitationSource[]
  cited: number[]
  provider: 'anthropic' | 'workers-ai'
  model: string
  latencyMs: number
  guarded: boolean
  logId: string | null
}

export interface FitRequest {
  roleTitle: string
  jobDescription: string
  company?: string | null
  cultureNotes?: string | null
  channel: Channel
  clientId: string
  keyId?: string | null
}

export interface FitDimension {
  /** 1 (poor) – 5 (excellent). */
  score: number
  summary: string
  strengths: string[]
  gaps: string[]
  /** Source numbers backing this dimension. */
  evidence: number[]
}

export interface FitAssessment {
  roleTitle: string
  company: string | null
  overall: { score: number; verdict: 'strong' | 'promising' | 'mixed' | 'weak'; summary: string }
  technical: FitDimension
  culture: FitDimension
  /** Things Raj would want to know or clarify before going further. */
  questionsForRaj: string[]
  /** Requirements the clone had no evidence for, so a human should ask. */
  unknowns: string[]
  sources: CitationSource[]
  provider: 'anthropic' | 'workers-ai'
  model: string
  logId: string | null
}

export interface RetrievedChunk {
  chunkId: string
  sourceId: string
  kind: SourceKind
  visibility: Visibility
  title: string
  topic: string | null
  anchor: string | null
  text: string
  scores: { bm25Rank: number | null; denseRank: number | null; dense: number | null; rrf: number; rerank: number | null }
}

export interface TopicSummary {
  topic: string
  label: string
  count: number
}
