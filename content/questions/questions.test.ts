import { describe, expect, it } from 'vitest'
import { TOPICS } from '@/content/topics'
import { questionSchema } from '@/lib/interview/schema'
import { INTERVIEW_TOPIC_IDS, INTERVIEW_TOPICS, QUESTIONS, QUESTION_TYPES, questionCounts } from './index'

describe('question bank', () => {
  it('has 170–220 questions', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(170)
    expect(QUESTIONS.length).toBeLessThanOrEqual(220)
  })

  it('has unique, well-formed ids that match their topic', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const q of QUESTIONS) expect(q.id).toMatch(new RegExp(`^${q.topic}-\\d{3}$`))
  })

  it('uses only known topics and types, and every question passes the pack schema', () => {
    for (const q of QUESTIONS) {
      expect(INTERVIEW_TOPIC_IDS).toContain(q.topic)
      expect(QUESTION_TYPES).toContain(q.type)
      const r = questionSchema.safeParse(q)
      expect(r.success, `${q.id}: ${r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`).toBe(true)
    }
  })

  it('gives this-or-that exactly two options and scale a real range', () => {
    for (const q of QUESTIONS) {
      if (q.type === 'this-or-that') {
        expect(q.options, q.id).toHaveLength(2)
        expect(q.options![0]).not.toBe(q.options![1])
      } else expect(q.options, q.id).toBeUndefined()
      if (q.type === 'scale') {
        expect(q.scale!.min, q.id).toBeLessThan(q.scale!.max)
        expect(q.scale!.minLabel.trim(), q.id).not.toBe('')
        expect(q.scale!.maxLabel.trim(), q.id).not.toBe('')
      } else expect(q.scale, q.id).toBeUndefined()
    }
  })

  it('covers every interview topic: at least 8 each, 20 in the lightning round', () => {
    const counts = questionCounts()
    for (const t of INTERVIEW_TOPIC_IDS) {
      if (t === 'notes') continue // Raj's own cards
      expect(counts[t], t).toBeGreaterThanOrEqual(8)
    }
    expect(counts.lightning).toBeGreaterThanOrEqual(20)
    expect(QUESTIONS.filter((q) => q.topic === 'lightning').every((q) => q.type === 'rapid')).toBe(true)
  })

  it('has deep cards in every topic and story hints that scaffold the story', () => {
    for (const t of INTERVIEW_TOPIC_IDS) {
      if (t === 'notes' || t === 'lightning') continue
      expect(QUESTIONS.filter((q) => q.topic === t && q.depth === 3).length, t).toBeGreaterThanOrEqual(3)
    }
    for (const q of QUESTIONS.filter((x) => x.type === 'story')) expect(q.hint, q.id).toMatch(/situation/i)
  })

  it('says why every question is asked, and has no duplicate prompts', () => {
    for (const q of QUESTIONS) expect(q.why.trim().length, q.id).toBeGreaterThan(10)
    const prompts = QUESTIONS.map((q) => q.prompt.toLowerCase().replace(/[^a-z]/g, ''))
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it('maps every interview topic to content/topics.ts', () => {
    expect(INTERVIEW_TOPICS.map((t) => t.id)).toEqual([...INTERVIEW_TOPIC_IDS])
    for (const t of INTERVIEW_TOPIC_IDS) expect(TOPICS.find((x) => x.id === t)?.origin).toBe('interview')
  })
})
