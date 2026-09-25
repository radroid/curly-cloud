/**
 * Response shapes for the studio's own admin routes (sources, logs, keys, stats).
 * Type-only: safe to import from client components.
 */
import type { ApiKeyRecord } from '@/lib/auth'
import type { corpusStats } from '@/lib/rag'
import type { Channel, IngestResult, SourceKind, Visibility } from '@/lib/rag/types'

export type { Answer, IngestResult, RetrievedChunk, SourceKind, SourceRecord, Visibility, Channel } from '@/lib/rag/types'

export interface Page<T> {
  items: T[]
  total: number
}

// ── Logs ─────────────────────────────────────────────────────────────────────

export interface LogItem {
  id: string
  channel: Channel
  kind: 'ask' | 'fit'
  clientId: string
  keyId: string | null
  /** Label of the MCP key that asked, if any. */
  keyLabel: string | null
  question: string
  answer: string
  /** Parsed `chat_logs.citations` JSON, as written by lib/rag. */
  citations: unknown[]
  /** Parsed `chat_logs.retrieved` JSON, as written by lib/rag. */
  retrieved: unknown[]
  provider: string | null
  model: string | null
  tokensIn: number
  tokensOut: number
  latencyMs: number
  guarded: boolean
  flagged: boolean
  correctionSourceId: string | null
  createdAt: number
}

/** A source referenced by a log, resolved against the current knowledge base. */
export interface LogSourceRef {
  /** Citation number the answer uses (`[n]`), when known. */
  n: number | null
  sourceId: string | null
  chunkId: string | null
  title: string
  kind: SourceKind | null
  visibility: Visibility | null
  topic: string | null
  /** False when the source has since been deleted or was never resolvable. */
  exists: boolean
  /** Best retrieval score recorded for it (rrf or rerank), when present. */
  score: number | null
  /** The answer text actually contains `[n]` for this source. */
  cited: boolean
}

export interface LogDetail extends LogItem {
  /** Numbered sources shown to the model, in `n` order. */
  numbered: LogSourceRef[]
  /** Unique sources retrieval returned, best first. */
  retrievedSources: LogSourceRef[]
}

export interface CorrectionResult {
  sourceId: string
  result: IngestResult
  log: LogItem
}

// ── Keys ─────────────────────────────────────────────────────────────────────

export interface KeyItem extends ApiKeyRecord {
  /** Count in the `mcp:k:<id>` rate-limit bucket for today's window (0 if untouched today). */
  usedToday: number
  questionsToday: number
  questionsTotal: number
  lastQuestionAt: number | null
}

export interface CreatedKey {
  /** Plaintext token. Returned once, never stored. */
  token: string
  record: ApiKeyRecord
}

// ── Stats ────────────────────────────────────────────────────────────────────

export type CorpusStats = Awaited<ReturnType<typeof corpusStats>>

export interface TopicCoverage {
  topic: string
  label: string
  origin: 'resume' | 'interview'
  /** Private sources (interview answers, notes, corrections) on this topic. */
  sources: number
  /** Approximate word count across those sources. */
  words: number
  /** Among the thinnest interview topics: answer more of these. */
  thin: boolean
}

export interface UsageDay {
  day: string
  requests: number
  tokensIn: number
  tokensOut: number
}

export interface ChannelCount {
  channel: Channel
  today: number
  week: number
}

export interface RecentQuestion {
  id: string
  channel: Channel
  question: string
  createdAt: number
  flagged: boolean
  guarded: boolean
}

export interface StudioStats {
  generatedAt: number
  /** From lib/rag `corpusStats`; null until the RAG stream is merged or if it fails. */
  corpus: CorpusStats | null
  corpusError?: string
  /** Straight from the sources table, so the dashboard works without lib/rag. */
  sourcesByKind: Record<SourceKind, number>
  coverage: TopicCoverage[]
  usage: UsageDay[]
  budget: { dailyTokens: number; usedToday: number }
  channels: ChannelCount[]
  flagged: number
  guarded: { week: number; total: number }
  corrections: number
  keys: { active: number; revoked: number }
  recent: RecentQuestion[]
}

// ── Routes owned by other streams (used by the studio UI) ────────────────────

export interface PersonaRecord {
  text: string
  updatedAt: number
}

export interface PersonaRebuild {
  text: string
  sourcesUsed: number
}

export interface ImportResult {
  result: IngestResult
  answers: number
}

