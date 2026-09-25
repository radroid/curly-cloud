/**
 * Public surface of the clone. Routes, the MCP server and the studio import from here only.
 * See CLONE-PLAN.md §4 for the architecture and lib/rag/types.ts for the shapes.
 */
import type { AppEnv } from '@/lib/env'
import { collectAnswer, runAnswer } from '@/lib/rag/answer'
import { assessFitWith } from '@/lib/rag/fit'
import { ingestSources as ingest, seedPublic } from '@/lib/rag/ingest'
import { readPersona, rebuildPersonaWith } from '@/lib/rag/persona'
import { retrieveChunks } from '@/lib/rag/retrieve'
import { stats, topicSummaries } from '@/lib/rag/stats'
import { deleteSourcesAndBump, getSourceRecord, listSourceRecords } from '@/lib/rag/store'
import type {
  Answer,
  AnswerEvent,
  AnswerRequest,
  FitAssessment,
  FitRequest,
  IngestResult,
  RetrievedChunk,
  SourceInput,
  SourceKind,
  SourceRecord,
  TopicSummary,
} from '@/lib/rag/types'

export { RagError } from '@/lib/rag/answer'
export { IngestLimitError, MAX_SOURCES_PER_INGEST } from '@/lib/rag/ingest'

/**
 * Stream a first-person answer as Raj. Yields `sources` once, then `delta`s, then `done`
 * (or `error`). Checks the daily token budget, retrieves, generates, runs the verbatim guard,
 * validates citations, records usage and writes a chat_logs row. Callers do rate limiting.
 */
export async function* answerStream(env: AppEnv, req: AnswerRequest): AsyncGenerator<AnswerEvent> {
  yield* runAnswer(env, req)
}

/** Non-streaming wrapper around `answerStream` (MCP, evals). Throws `RagError` on an error event. */
export async function answer(env: AppEnv, req: AnswerRequest): Promise<Answer> {
  return collectAnswer(env, req)
}

/** Structured role-fit assessment grounded in retrieved sources. Throws `RagError`. */
export async function assessFit(env: AppEnv, req: FitRequest): Promise<FitAssessment> {
  return assessFitWith(env, req)
}

/**
 * Upsert sources by id (unchanged content hashes are skipped), re-chunk and embed changed ones,
 * bump corpus_version. With `replaceKind`, sources of that kind not in `inputs` are deleted
 * (used by the resume seed so removed bullets disappear). Throws `IngestLimitError` above 500.
 */
export async function ingestSources(env: AppEnv, inputs: SourceInput[], opts: { replaceKind?: SourceKind } = {}): Promise<IngestResult> {
  return ingest(env, inputs, opts)
}

/** Seed/refresh the public half of the corpus from content/resume.ts. Idempotent. */
export async function seedPublicSources(env: AppEnv): Promise<IngestResult> {
  return seedPublic(env)
}

/** Delete sources (and their chunks). Returns how many sources were deleted. */
export async function deleteSources(env: AppEnv, ids: string[]): Promise<number> {
  return deleteSourcesAndBump(env.DB, ids)
}

export async function getSource(env: AppEnv, id: string): Promise<SourceRecord | null> {
  return getSourceRecord(env.DB, id)
}

export async function listSources(
  env: AppEnv,
  filter: { kind?: SourceKind; topic?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: SourceRecord[]; total: number }> {
  return listSourceRecords(env.DB, filter)
}

/** Hybrid retrieval with scores, for the studio playground and evals. */
export async function retrieve(env: AppEnv, query: string, opts: { k?: number; rerank?: boolean } = {}): Promise<RetrievedChunk[]> {
  return retrieveChunks(env, query, opts)
}

/** Topics the clone has knowledge about, with counts. Never includes private text. */
export async function listTopics(env: AppEnv): Promise<TopicSummary[]> {
  return topicSummaries(env.DB)
}

export async function corpusStats(env: AppEnv): Promise<{
  sources: Record<SourceKind, number>
  chunks: number
  embedded: number
  corpusVersion: number
  topics: TopicSummary[]
  persona: { updatedAt: number | null; chars: number }
}> {
  return stats(env)
}

export async function getPersona(env: AppEnv): Promise<{ text: string; updatedAt: number } | null> {
  return readPersona(env.DB)
}

/** Distil private answers into a voice/principles profile used in the system prompt. */
export async function rebuildPersona(env: AppEnv): Promise<{ text: string; sourcesUsed: number }> {
  return rebuildPersonaWith(env)
}
