import { describe, expect, it } from 'vitest'
import { readableAnswer } from '@/lib/studio/shared'

describe('readableAnswer', () => {
  it('turns a logged fit assessment into prose', () => {
    const json = JSON.stringify({
      overall: { verdict: 'promising', score: 4, summary: 'Strong on RAG.' },
      technical: { score: 4, summary: 'Ships evals.' },
      culture: { score: 3, summary: 'Little evidence.' },
      unknowns: ['Kubernetes'],
    })
    const out = readableAnswer('fit', json)
    expect(out).toContain('promising (4/5): Strong on RAG.')
    expect(out).toContain('Technical 4/5: Ships evals.')
    expect(out).toContain('Unknowns: Kubernetes')
  })

  it('leaves chat answers and malformed fit rows untouched', () => {
    expect(readableAnswer('ask', 'I built it [1].')).toBe('I built it [1].')
    expect(readableAnswer('fit', 'not json')).toBe('not json')
  })
})
