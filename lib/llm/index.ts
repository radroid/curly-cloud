/**
 * `getLlm(env)` picks Anthropic when ANTHROPIC_API_KEY is set, otherwise Workers AI.
 * Embeddings and reranking always go through Workers AI.
 */
import type { AppEnv } from '@/lib/env'
import { createAnthropicLlm, type AnthropicClientLike } from '@/lib/llm/anthropic'
import type { Llm } from '@/lib/llm/types'
import { asAiRunner, createWorkersAiLlm, embedTexts, rerankTexts } from '@/lib/llm/workers-ai'

export * from '@/lib/llm/types'

type LlmEnv = Pick<AppEnv, 'AI' | 'ANTHROPIC_API_KEY' | 'ANTHROPIC_MODEL' | 'WORKERS_AI_CHAT_MODEL'>

const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5'
const DEFAULT_WORKERS_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
export const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-m3'
export const DEFAULT_RERANK_MODEL = '@cf/baai/bge-reranker-base'

/** Per-isolate cache so the Anthropic client (and its connection pool) is reused across requests. */
let cached: { key: string; llm: Llm } | null = null

export function getLlm(env: LlmEnv, overrides: { anthropicClient?: AnthropicClientLike } = {}): Llm {
  if (env.ANTHROPIC_API_KEY) {
    const model = env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL
    if (overrides.anthropicClient) return createAnthropicLlm({ model, client: overrides.anthropicClient })
    const key = `anthropic:${model}:${env.ANTHROPIC_API_KEY.slice(-8)}`
    if (cached?.key !== key) cached = { key, llm: createAnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model }) }
    return cached.llm
  }
  return createWorkersAiLlm({ ai: asAiRunner(env.AI), model: env.WORKERS_AI_CHAT_MODEL || DEFAULT_WORKERS_MODEL })
}

export function embeddingModel(env: Pick<AppEnv, 'EMBEDDING_MODEL'>): string {
  return env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
}

export async function embed(env: Pick<AppEnv, 'AI' | 'EMBEDDING_MODEL'>, texts: string[]): Promise<number[][]> {
  return embedTexts(asAiRunner(env.AI), embeddingModel(env), texts)
}

export async function rerank(
  env: Pick<AppEnv, 'AI' | 'RERANK_MODEL'>,
  query: string,
  texts: string[],
  topK?: number,
): Promise<{ index: number; score: number }[]> {
  return rerankTexts(asAiRunner(env.AI), env.RERANK_MODEL || DEFAULT_RERANK_MODEL, query, texts, topK)
}
