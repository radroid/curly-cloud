import type { SourceInput } from '@/lib/rag/types'
import { answerProse, countWords, isAnswerEmpty, STORY_PART_KEYS, STORY_PART_LABELS } from './core'
import type { ParsedExport } from './schema'

type ExportedAnswer = ParsedExport['answers'][number]

/** Declarative sentences of a scenario prompt, i.e. the situation without the question. */
function restateScenario(prompt: string): string {
  const sentences = prompt.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [prompt]
  const setup = sentences.map((s) => s.trim()).filter((s) => s && !s.endsWith('?'))
  const brief = (setup.length ? setup.join(' ') : prompt).trim()
  return brief.length > 400 ? `${brief.slice(0, 399)}…` : brief
}

function storySections(a: ExportedAnswer['answer']): string[] {
  const out: string[] = []
  for (const k of STORY_PART_KEYS) {
    const v = a.parts?.[k]?.trim()
    if (v) out.push(`${STORY_PART_LABELS[k]}: ${v}`)
  }
  return out
}

/** Render one answer as first-person prose that keeps the meaning of its question type. */
export function formatAnswerBody(item: ExportedAnswer): string {
  const a = item.answer
  const text = a.text.trim()
  switch (item.type) {
    case 'this-or-that': {
      const [x, y] = item.options ?? ['', '']
      const choice = a.choice?.trim()
      const other = choice === x ? y : choice === y ? x : null
      const lead = choice && other ? `I'd pick ${choice} over ${other}.` : `Between ${x} and ${y}:`
      return text ? `${lead} Why: ${text}` : lead
    }
    case 'scale': {
      const s = item.scale ?? { min: 1, max: 5, minLabel: 'low', maxLabel: 'high' }
      const lead =
        typeof a.value === 'number'
          ? `On a scale from ${s.minLabel} (${s.min}) to ${s.maxLabel} (${s.max}), I'm a ${a.value}/${s.max}.`
          : `On a scale from ${s.minLabel} (${s.min}) to ${s.maxLabel} (${s.max}):`
      return text ? `${lead} Why: ${text}` : lead
    }
    case 'story':
      return [text, ...storySections(a)].filter(Boolean).join('\n\n')
    case 'scenario': {
      const body = answerProse(a)
      return `Scenario: ${restateScenario(item.prompt)}\n\nWhat I'd do: ${body}`
    }
    case 'rapid':
      return `Quick answer to "${item.prompt.trim()}": ${text}`
    default:
      return [text, ...storySections(a)].filter(Boolean).join('\n\n')
  }
}

/**
 * Map a validated `raj-clone-answers` export to private knowledge-base sources, one per answered
 * card. Empty answers are skipped. Ids are stable (`interview:<qid>`), so re-importing an edited
 * answer updates it in place.
 */
export function answersToSources(exported: ParsedExport): SourceInput[] {
  const out: SourceInput[] = []
  for (const item of exported.answers) {
    if (isAnswerEmpty(item.answer)) continue
    const custom = item.source === 'custom'
    const body = formatAnswerBody(item)
    const meta: Record<string, unknown> = {
      type: item.type,
      qid: item.qid,
      depth: item.depth,
      answeredAt: item.answeredAt,
      updatedAt: item.updatedAt,
      wordCount: countWords(answerProse(item.answer)),
      source: 'interview-stack',
      card: item.source,
    }
    if (item.starred) meta.starred = true
    if (item.packId) meta.packId = item.packId
    out.push({
      id: `interview:${item.qid}`,
      kind: custom ? 'note' : 'interview',
      visibility: 'private',
      title: item.prompt.trim(),
      topic: item.topic,
      body,
      meta,
    })
  }
  return out
}
