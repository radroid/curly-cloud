/**
 * Public surface of the clone. Routes, the MCP server and the studio import from here only.
 *
 * FOUNDATION STUB — the RAG workstream (feat/clone-rag) replaces these bodies. Signatures and
 * behaviour described in the JSDoc are the contract; see CLONE-PLAN.md §4.
 */
import type { AppEnv } from '@/lib/env'
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

const notYet = (name: string): never => {
  throw new Error(`lib/rag.${name} is not implemented yet`)
}

/**
 * Stream a first-person answer as Raj. Yields `sources` once, then `delta`s, then `done`
 * (or `error`). Checks the daily token budget, retrieves, generates, runs the verbatim guard,
 * validates citations, records usage and writes a chat_logs row. Callers do rate limiting.
 */
export async function* answerStream(env: AppEnv, req: AnswerRequest): AsyncGenerator<AnswerEvent> {
  void env
  void req
  yield notYet('answerStream')
}

/** Non-streaming wrapper around `answerStream` (MCP, evals). */
export async function answer(env: AppEnv, req: AnswerRequest): Promise<Answer> {
  void env
  void req
  return notYet('answer')
}

/** Structured role-fit assessment grounded in retrieved sources. */
export async function assessFit(env: AppEnv, req: FitRequest): Promise<FitAssessment> {
  void env
  void req
  return notYet('assessFit')
}

/**
 * Upsert sources by id (unchanged content hashes are skipped), re-chunk and embed changed ones,
 * bump corpus_version. With `replaceKind`, sources of that kind not in `inputs` are deleted
 * (used by the resume seed so removed bullets disappear).
 */
export async function ingestSources(env: AppEnv, inputs: SourceInput[], opts: { replaceKind?: SourceKind } = {}): Promise<IngestResult> {
  void env
  void inputs
  void opts
  return notYet('ingestSources')
}

/** Seed/refresh the public half of the corpus from content/resume.ts. Idempotent. */
export async function seedPublicSources(env: AppEnv): Promise<IngestResult> {
  void env
  return notYet('seedPublicSources')
}

export async function deleteSources(env: AppEnv, ids: string[]): Promise<number> {
  void env
  void ids
  return notYet('deleteSources')
}

export async function getSource(env: AppEnv, id: string): Promise<SourceRecord | null> {
  void env
  void id
  return notYet('getSource')
}

export async function listSources(
  env: AppEnv,
  filter: { kind?: SourceKind; topic?: string; q?: string; limit?: number; offset?: number } = {},
): Promise<{ items: SourceRecord[]; total: number }> {
  void env
  void filter
  return notYet('listSources')
}

/** Hybrid retrieval with scores, for the studio playground and evals. */
export async function retrieve(env: AppEnv, query: string, opts: { k?: number; rerank?: boolean } = {}): Promise<RetrievedChunk[]> {
  void env
  void query
  void opts
  return notYet('retrieve')
}

/** Topics the clone has knowledge about, with counts. Never includes private text. */
export async function listTopics(env: AppEnv): Promise<TopicSummary[]> {
  void env
  return notYet('listTopics')
}

export async function corpusStats(env: AppEnv): Promise<{
  sources: Record<SourceKind, number>
  chunks: number
  embedded: number
  corpusVersion: number
  topics: TopicSummary[]
  persona: { updatedAt: number | null; chars: number }
}> {
  void env
  return notYet('corpusStats')
}

export async function getPersona(env: AppEnv): Promise<{ text: string; updatedAt: number } | null> {
  void env
  return notYet('getPersona')
}

/** Distil private answers into a voice/principles profile used in the system prompt. */
export async function rebuildPersona(env: AppEnv): Promise<{ text: string; sourcesUsed: number }> {
  void env
  return notYet('rebuildPersona')
}
