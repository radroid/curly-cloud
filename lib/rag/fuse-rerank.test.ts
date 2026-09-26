import { describe, expect, it } from 'vitest'
import type { RetrievedChunk } from '@/lib/rag/types'
import { fuseRerank } from '@/lib/rag/retrieve'

const chunk = (id: string, bm25Rank: number | null, denseRank: number | null, rerank: number | null): RetrievedChunk => ({
  chunkId: id,
  sourceId: id,
  kind: 'resume',
  visibility: 'public',
  title: id,
  topic: null,
  anchor: null,
  text: id,
  scores: { bm25Rank, denseRank, dense: null, rrf: 0, rerank },
})

describe('fuseRerank', () => {
  it('does not let a near-zero rerank score bury a chunk both retrievers rank highly', () => {
    const out = fuseRerank([
      chunk('both-retrievers-like-it', 2, 1, 0.0001),
      chunk('reranker-favourite', 9, 12, 0.9),
      chunk('middling', 5, 6, 0.2),
      chunk('weak', 14, 15, 0.1),
    ])
    expect(out.map((c) => c.chunkId).indexOf('both-retrievers-like-it')).toBeLessThan(2)
    expect(out.at(-1)?.chunkId).toBe('weak')
  })

  it('lets the reranker break a tie between retrievers', () => {
    const out = fuseRerank([chunk('a', 1, 2, 0.1), chunk('b', 2, 1, 0.8)])
    expect(out[0].chunkId).toBe('b')
  })
})
