/**
 * Turn retrieved chunks into numbered sources: one number per source (chunks of the same source
 * are merged), in rank order. Public sources carry a short snippet; private ones never do.
 */
import { stripHeader } from '@/lib/rag/chunk'
import type { CitationSource, RetrievedChunk, Visibility } from '@/lib/rag/types'

export const SNIPPET_CHARS = 240
const MAX_CHARS_PER_SOURCE = 2400

export interface ContextSource {
  citation: CitationSource
  /** Full text shown to the model (server-side only). */
  text: string
  visibility: Visibility
}

export function snippet(text: string, max = SNIPPET_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`
}

/**
 * Resume bodies repeat their role/build header ("Lead Software Developer at Eddy Solutions, Toronto,
 * ON (Apr 2026 – Present). …"); the title already names it, so the snippet starts after it.
 */
export function snippetSource(kind: CitationSource['kind'], text: string): string {
  if (kind !== 'resume') return text
  const rest = text.replace(/^.{0,240}?\)\.\s+/s, '')
  return rest.trim() ? rest : text
}

export function buildContext(chunks: RetrievedChunk[], maxSources = 8): ContextSource[] {
  const bySource = new Map<string, { first: RetrievedChunk; pieces: { ord: number; text: string }[] }>()
  for (const c of chunks) {
    const ord = Number(c.chunkId.split('#').pop()) || 0
    const entry = bySource.get(c.sourceId)
    if (entry) {
      if (!entry.pieces.some((p) => p.ord === ord)) entry.pieces.push({ ord, text: stripHeader(c.text) })
    } else if (bySource.size < maxSources) {
      bySource.set(c.sourceId, { first: c, pieces: [{ ord, text: stripHeader(c.text) }] })
    }
  }
  let n = 0
  return [...bySource.values()].map(({ first, pieces }) => {
    pieces.sort((a, b) => a.ord - b.ord)
    const text = pieces
      .map((p) => p.text)
      .join('\n…\n')
      .slice(0, MAX_CHARS_PER_SOURCE)
    const isPublic = first.visibility === 'public'
    const citation: CitationSource = {
      n: ++n,
      id: first.sourceId,
      kind: first.kind,
      visibility: first.visibility,
      title: first.title,
      topic: first.topic,
      anchor: isPublic ? first.anchor : null,
      snippet: isPublic ? snippet(snippetSource(first.kind, text)) : null,
    }
    return { citation, text, visibility: first.visibility }
  })
}
