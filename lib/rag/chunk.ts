/**
 * Chunking: short sources (resume bullets, most answers) become one chunk; long answers split
 * about every 900 chars on paragraph/sentence boundaries with a small overlap. Every chunk gets a
 * one-line contextual header (kind · topic label · title) before embedding and indexing.
 */
import { topicLabel } from '@/content/topics'
import type { SourceInput, SourceKind } from '@/lib/rag/types'
import { sha256Hex } from '@/lib/security/crypto'

/** Bump when chunking or headers change so every source is re-chunked on the next ingest. */
export const CHUNKER_VERSION = 1

export const SINGLE_CHUNK_MAX = 1200
export const CHUNK_TARGET = 900
export const CHUNK_OVERLAP = 150

const KIND_LABEL: Record<SourceKind, string> = {
  resume: 'Resume',
  profile: 'Profile',
  interview: 'Interview answer',
  note: 'Note',
  correction: 'Correction',
}

export interface ChunkDraft {
  id: string
  ord: number
  text: string
  tokenEstimate: number
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function chunkHeader(source: Pick<SourceInput, 'kind' | 'topic' | 'title'>): string {
  return `${KIND_LABEL[source.kind]} · ${topicLabel(source.topic)} · ${oneLine(source.title)}`
}

/** The chunk body without its header line (for prompts, snippets and the verbatim guard). */
export function stripHeader(chunkText: string): string {
  const nl = chunkText.indexOf('\n')
  return nl === -1 ? chunkText : chunkText.slice(nl + 1)
}

interface Unit {
  text: string
  paraEnd: boolean
}

function hardSplit(text: string, max: number): string[] {
  const words = text.split(/\s+/)
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > max) {
      out.push(cur)
      cur = w
    } else {
      cur = cur ? `${cur} ${w}` : w
    }
  }
  if (cur) out.push(cur)
  return out
}

function splitUnits(body: string): Unit[] {
  const units: Unit[] = []
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const para of paragraphs) {
    const sentences = para
      .split(/(?<=[.!?…]["'”’)\]]?)\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const pieces = sentences.flatMap((s) => (s.length > CHUNK_TARGET ? hardSplit(s, CHUNK_TARGET) : [s]))
    pieces.forEach((text, i) => units.push({ text, paraEnd: i === pieces.length - 1 }))
  }
  return units
}

function join(units: Unit[]): string {
  let out = ''
  units.forEach((u, i) => {
    out += u.text
    if (i < units.length - 1) out += u.paraEnd ? '\n\n' : ' '
  })
  return out
}

/** Split a body into chunk-sized pieces (without headers). */
export function splitBody(body: string): string[] {
  const clean = body.replace(/\r\n/g, '\n').trim()
  if (clean.length <= SINGLE_CHUNK_MAX) return clean ? [clean] : []
  const units = splitUnits(clean)
  const pieces: string[] = []
  let cur: Unit[] = []
  let len = 0
  for (const u of units) {
    if (cur.length && len + u.text.length + 1 > CHUNK_TARGET) {
      pieces.push(join(cur))
      // Carry trailing sentences (up to CHUNK_OVERLAP chars) into the next chunk.
      const overlap: Unit[] = []
      let olen = 0
      for (let i = cur.length - 1; i >= 0; i--) {
        if (olen + cur[i].text.length > CHUNK_OVERLAP) break
        overlap.unshift(cur[i])
        olen += cur[i].text.length + 1
      }
      cur = overlap
      len = olen
    }
    cur.push(u)
    len += u.text.length + 1
  }
  if (cur.length) pieces.push(join(cur))
  return pieces
}

export function chunkSource(source: SourceInput): ChunkDraft[] {
  const header = chunkHeader(source)
  return splitBody(source.body).map((piece, ord) => {
    const text = `${header}\n${piece}`
    return { id: `${source.id}#${ord}`, ord, text, tokenEstimate: Math.ceil(text.length / 4) }
  })
}

/** Stable hash of everything that affects chunks. Unchanged hash ⇒ skip on re-ingest. */
export async function contentHash(source: SourceInput): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      CHUNKER_VERSION,
      source.kind,
      source.visibility,
      source.title,
      source.topic ?? null,
      source.anchor ?? null,
      source.body,
      source.meta ?? {},
    ]),
  )
}
